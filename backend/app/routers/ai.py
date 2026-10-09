import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.auth.access import get_accessible_session
from app.auth.dependencies import AuthUser, ensure_user_row, get_optional_user
from app.config import settings
from app.database import SessionLocal
from app.models import AIMessage, CodingSession
from app.schemas.ai import (
    ChatRequest,
    CompleteRequest,
    CompleteResponse,
    ReviewRequest,
    ReviewResponse,
)
from app.services import ai, ai_prompts
from app.services.code_source import current_code
from app.utils.rate_limit import RequestLimiter

log = logging.getLogger("uvicorn.error")
router = APIRouter(prefix="/sessions/{slug}/ai", tags=["ai"])

chat_limiter = RequestLimiter(max_requests=settings.ai_chat_per_minute, window_seconds=60)
review_limiter = RequestLimiter(max_requests=settings.ai_review_per_minute, window_seconds=60)
complete_limiter = RequestLimiter(max_requests=settings.ai_complete_per_minute, window_seconds=60)
daily_chat = RequestLimiter(max_requests=settings.ai_daily_chat, window_seconds=86_400)
daily_complete = RequestLimiter(max_requests=settings.ai_daily_complete, window_seconds=86_400)


def _require_ai() -> None:
    if not ai.is_available():
        raise HTTPException(status_code=503, detail="AI features aren't enabled on this server.")


def _check_limits(request: Request, session: CodingSession, per_person: RequestLimiter, daily: RequestLimiter) -> None:
    client_ip = request.client.host if request.client else "unknown"
    if not per_person.allow(f"{client_ip}:{session.slug}"):
        raise HTTPException(status_code=429, detail="You're sending requests too fast. Wait a moment and try again.")
    if not daily.allow(session.slug):
        raise HTTPException(status_code=429, detail="This session has used its AI allowance for today.")


def _line(payload: dict) -> str:
    return json.dumps(payload) + "\n"


async def _save_turn(session: CodingSession, user: AuthUser | None, question: str, answer: str) -> None:
    """Keeps a record in the ai_messages table. Never lets a database problem break the chat."""
    try:
        async with SessionLocal() as db:
            user_id = None
            if user is not None:
                await ensure_user_row(db, user)
                user_id = user.id
            db.add_all(
                [
                    AIMessage(session_id=session.id, user_id=user_id, role="user", content=question[:8000]),
                    AIMessage(session_id=session.id, user_id=user_id, role="assistant", content=answer),
                ]
            )
            await db.commit()
    except Exception:
        log.exception("Could not save the AI conversation")


@router.post("/chat")
async def chat(
    payload: ChatRequest,
    request: Request,
    session: CodingSession = Depends(get_accessible_session),
    user: AuthUser | None = Depends(get_optional_user),
):
    _require_ai()
    _check_limits(request, session, chat_limiter, daily_chat)

    code = await current_code(session.slug, session.id)
    system = ai_prompts.chat_system(payload.language, code)

    messages = [turn.model_dump() for turn in payload.messages]
    question = messages[-1]["content"]
    if payload.selection:
        messages[-1] = {
            "role": "user",
            "content": ai_prompts.with_selection(question, payload.selection, payload.selection_start_line),
        }

    async def events() -> AsyncIterator[str]:
        pieces: list[str] = []
        try:
            async for piece in ai.stream_chat(
                model=settings.ai_chat_model, system=system, messages=messages, max_tokens=1500
            ):
                pieces.append(piece)
                yield _line({"t": "delta", "text": piece})
        except ai.AIUnavailable as exc:
            yield _line({"t": "error", "message": str(exc)})
            return
        except Exception:
            log.exception("The AI chat stream failed")
            yield _line({"t": "error", "message": "Something went wrong while answering. Please try again."})
            return

        answer = "".join(pieces)
        if answer.strip():
            await _save_turn(session, user, question, answer)
        yield _line({"t": "done"})

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/review", response_model=ReviewResponse)
async def review(
    payload: ReviewRequest,
    request: Request,
    session: CodingSession = Depends(get_accessible_session),
):
    _require_ai()
    _check_limits(request, session, review_limiter, daily_chat)

    code = await current_code(session.slug, session.id)
    if not code.strip():
        raise HTTPException(status_code=400, detail="There is no code to review yet.")

    clipped, truncated = ai_prompts.clip(code)
    total_lines = clipped.count("\n") + 1

    try:
        raw = await ai.complete(
            model=settings.ai_review_model,
            system=ai_prompts.REVIEW_SYSTEM,
            messages=[{"role": "user", "content": ai_prompts.review_user(payload.language, clipped)}],
            max_tokens=3000,
        )
    except ai.AIUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    parsed = ai_prompts.parse_review(raw, total_lines)
    if parsed is None:
        raise HTTPException(status_code=502, detail="The AI answered in a format that couldn't be read. Please try again.")

    summary, findings = parsed
    return ReviewResponse(summary=summary, findings=findings, truncated=truncated)


@router.post("/complete", response_model=CompleteResponse)
async def complete(
    payload: CompleteRequest,
    request: Request,
    session: CodingSession = Depends(get_accessible_session),
):
    _require_ai()
    _check_limits(request, session, complete_limiter, daily_complete)

    try:
        raw = await ai.complete(
            model=settings.ai_completion_model,
            system=ai_prompts.COMPLETION_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": ai_prompts.completion_user(payload.language, payload.before, payload.after),
                }
            ],
            max_tokens=150,
        )
    except ai.AIUnavailable as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return CompleteResponse(completion=ai_prompts.clean_completion(raw))