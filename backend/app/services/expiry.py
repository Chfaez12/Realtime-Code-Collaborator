import asyncio
import logging

from sqlalchemy import delete, func, select

from app.database import SessionLocal
from app.models import (
    AIMessage,
    ChatMessage,
    CodingSession,
    Comment,
    Participant,
    SessionDocument,
    Snapshot,
)
from app.sync import persistence, registry

log = logging.getLogger("uvicorn.error")

CHECK_INTERVAL_SECONDS = 30
STARTUP_DELAY_SECONDS = 5
BATCH_SIZE = 50
CLOSE_EXPIRED = 4410  # the same code the sync socket uses for an expired session

# Everything that belongs to a session. Listed explicitly, so cleanup never depends on database settings.
_CHILD_MODELS = (SessionDocument, Participant, Snapshot, ChatMessage, Comment, AIMessage)


async def purge_expired_once() -> int:
    """Permanently deletes sessions whose expiry time has passed, with all of their data.
    Returns how many sessions were deleted. Persistent sessions are never touched."""
    async with SessionLocal() as db:
        result = await db.execute(
            select(CodingSession.id, CodingSession.slug)
            .where(
                CodingSession.expires_at.is_not(None),
                CodingSession.expires_at < func.now(),
                CodingSession.is_persistent.is_(False),
            )
            .limit(BATCH_SIZE)
        )
        expired = result.all()

    if not expired:
        return 0

    # Order matters: first stop saving the live rooms, then disconnect people, then delete.
    # Otherwise leaving clients would trigger one last save of a session that is going away.
    for row in expired:
        await persistence.discard_room(row.slug)
    for row in expired:
        await registry.kick_all(row.slug, CLOSE_EXPIRED)

    ids = [row.id for row in expired]
    async with SessionLocal() as db:
        for model in _CHILD_MODELS:
            await db.execute(delete(model).where(model.session_id.in_(ids)))
        await db.execute(delete(CodingSession).where(CodingSession.id.in_(ids)))
        await db.commit()  # one transaction: all of it, or nothing

    return len(ids)


async def run_expiry_loop() -> None:
    await asyncio.sleep(STARTUP_DELAY_SECONDS)  # let the server finish starting
    while True:
        try:
            removed = await purge_expired_once()
            if removed:
                log.info("Deleted %d expired session(s) and all of their data", removed)
        except Exception:
            log.exception("The expiry cleanup failed; it will try again")
        await asyncio.sleep(CHECK_INTERVAL_SECONDS)