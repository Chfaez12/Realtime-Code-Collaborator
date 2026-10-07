from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.access import get_accessible_session
from app.models import CodingSession
from app.schemas.execute import ExecuteRequest, ExecuteResponse
from app.services import piston_client
from app.utils.rate_limit import RequestLimiter

router = APIRouter(prefix="/sessions/{slug}", tags=["execute"])

# 30 runs per minute per client and session
run_limiter = RequestLimiter(max_requests=30, window_seconds=60)

@router.post("/execute", response_model=ExecuteResponse)
async def execute_code(
    payload: ExecuteRequest,
    request: Request,
    session: CodingSession = Depends(get_accessible_session),
):
    print("LANGUAGE:", payload.language)
    print("CODE:", payload.code)
    print("STDIN:", repr(payload.stdin))
    
    if payload.language not in piston_client.LANGUAGES:
        raise HTTPException(status_code=422, detail=f"Unsupported language: {payload.language}")

    client_ip = request.client.host if request.client else "unknown"
    if not run_limiter.allow(f"{client_ip}:{session.slug}"):
        raise HTTPException(status_code=429, detail="You're running code too fast. Wait a moment and try again.")

    result = await piston_client.execute(payload.language, payload.code, payload.stdin)
    return ExecuteResponse(
        stdout=result.stdout,
        stderr=result.stderr,
        exit_code=result.exit_code,
        phase=result.phase,
        duration_ms=result.duration_ms,
    )