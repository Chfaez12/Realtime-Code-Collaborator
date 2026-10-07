import asyncio
import logging
import uuid

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from app.auth.dependencies import ensure_user_row, verify_access_token
from app.database import SessionLocal
from app.models import Participant
from app.sync import persistence

log = logging.getLogger("uvicorn.error")

_tasks: set[asyncio.Task] = set()


def _log_failure(task: asyncio.Task) -> None:
    _tasks.discard(task)
    if task.cancelled():
        return
    error = task.exception()
    if error is not None:
        log.error("Could not record a participant", exc_info=error)


def spawn(coroutine) -> None:
    """Runs a background task and keeps a reference so it isn't garbage collected mid-run."""
    task = asyncio.create_task(coroutine)
    _tasks.add(task)
    task.add_done_callback(_log_failure)


async def record_participant(
    session_id: uuid.UUID,
    *,
    role: str,
    name: str | None,
    access_token: str | None,
) -> None:
    """Records that someone joined a session. Logged-in people get one row per session;
    guests get one row per display name."""
    user = await verify_access_token(access_token) if access_token else None
    if user is None and not name:
        return  # a row needs either an account or a name

    async with SessionLocal() as db:
        if user is not None:
            await ensure_user_row(db, user)
            persistence.note_verified_user(session_id, user.id)
            stmt = insert(Participant).values(
                session_id=session_id, user_id=user.id, guest_name=name, role=role
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[Participant.session_id, Participant.user_id],
                index_where=Participant.user_id.is_not(None),
                set_={"role": stmt.excluded.role, "guest_name": stmt.excluded.guest_name},
            )
            await db.execute(stmt)
        else:
            result = await db.execute(
                select(Participant.id)
                .where(
                    Participant.session_id == session_id,
                    Participant.user_id.is_(None),
                    Participant.guest_name == name,
                )
                .limit(1)
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                await db.execute(update(Participant).where(Participant.id == existing).values(role=role))
            else:
                db.add(Participant(session_id=session_id, guest_name=name, role=role))
        await db.commit()