import asyncio
import logging
import time
import uuid

from datetime import datetime, timezone

from pycrdt import Array, Doc, Text

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models import ChatMessage, Comment, SessionDocument, Snapshot


log = logging.getLogger("sync.persistence")


SAVE_INTERVAL_SECONDS = 2.0            # at most one document write per room per interval
AUTO_SNAPSHOT_INTERVAL_SECONDS = 300  # at most one automatic snapshot per 5 minutes of editing
AUTO_SNAPSHOT_KEEP = 50                # older automatic snapshots are deleted; checkpoints never are


def text_of_doc(ydoc) -> str:
    return str(ydoc.get("monaco", type=Text))


def text_of_state(state: bytes) -> str:
    doc = Doc()
    doc.apply_update(state)
    return text_of_doc(doc)


async def load_state(session_id: uuid.UUID) -> bytes | None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(SessionDocument.state).where(SessionDocument.session_id == session_id)
        )
        return result.scalar_one_or_none()


async def save_state(session_id: uuid.UUID, state: bytes) -> None:
    async with SessionLocal() as db:
        stmt = insert(SessionDocument).values(session_id=session_id, state=state)
        stmt = stmt.on_conflict_do_update(
            index_elements=[SessionDocument.session_id],
            set_={"state": stmt.excluded.state, "updated_at": func.now()},
        )
        await db.execute(stmt)
        await db.commit()


async def add_snapshot(
    db: AsyncSession,
    session_id: uuid.UUID,
    state: bytes,
    content: str,
    label: str | None,
    is_manual: bool,
    created_by: uuid.UUID | None = None,
) -> Snapshot:
    snapshot = Snapshot(
        session_id=session_id,
        doc_state=state,
        content=content,
        label=label,
        is_manual=is_manual,
        created_by=created_by,
    )
    db.add(snapshot)
    await db.commit()
    await db.refresh(snapshot)  
    return snapshot

async def prune_auto_snapshots(db: AsyncSession, session_id: uuid.UUID) -> None:
    newest = (
        select(Snapshot.id)
        .where(Snapshot.session_id == session_id, Snapshot.is_manual.is_(False))
        .order_by(Snapshot.created_at.desc())
        .limit(AUTO_SNAPSHOT_KEEP)
    )

    await db.execute(
        delete(Snapshot).where(
            Snapshot.session_id == session_id,
            Snapshot.is_manual.is_(False),
            Snapshot.id.not_in(newest),
        )
    )
    await db.commit()


async def _latest_snapshot_content(session_id: uuid.UUID) -> str | None:
    async with SessionLocal() as db:
        result = await db.execute(
            select(Snapshot.content)
            .where(Snapshot.session_id == session_id)
            .order_by(Snapshot.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()


# ---------- Live room tracking ----------


class _Tracked:
    """Bookkeeping for one live room."""

    def __init__(self, room, slug: str, session_id: uuid.UUID):
        self.room = room
        self.slug = slug
        self.session_id = session_id
        self.subscription = None
        self.task: asyncio.Task | None = None
        self.dirty = False
        self.last_snapshot_at = time.monotonic()
        self.last_snapshot_content: str | None = None
        self.mirrored_ids: set[uuid.UUID] | None = None
        self.mirrored_chat_ids: set[uuid.UUID] | None = None  # chat message ids already copied to the database
        self.verified_users: set[uuid.UUID] = set()

_active: dict[str, _Tracked] = {}
_attach_lock = asyncio.Lock()


def get_active_room(slug: str):
    """The live room for a session, or None if nobody is connected."""
    tracked = _active.get(slug)
    return tracked.room if tracked else None


async def _maybe_auto_snapshot(t: _Tracked, state: bytes, final: bool) -> None:
    due = final or (time.monotonic() - t.last_snapshot_at >= AUTO_SNAPSHOT_INTERVAL_SECONDS)
    if not due:
        return

    content = text_of_doc(t.room.ydoc)
    if content == (t.last_snapshot_content or ""):
        t.last_snapshot_at = time.monotonic()  # nothing new to record
        return

    async with SessionLocal() as db:
        await add_snapshot(db, t.session_id, state, content, label=None, is_manual=False)
        await prune_auto_snapshots(db, t.session_id)

    t.last_snapshot_content = content
    t.last_snapshot_at = time.monotonic()


MAX_MIRRORED_COMMENTS = 500


def _read_comments(ydoc) -> dict[uuid.UUID, dict]:
    """The comments currently in the shared document, checked and cleaned.
    Anything malformed is skipped, because this data comes from browsers."""
    try:
        raw = ydoc.get("comments", type=Array).to_py() or []
    except Exception:
        return {}

    found: dict[uuid.UUID, dict] = {}
    for item in raw[:MAX_MIRRORED_COMMENTS]:
        if not isinstance(item, dict):
            continue

        try:
            comment_id = uuid.UUID(str(item.get("id")))
        except ValueError:
            continue

        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            continue

        try:
            line_number = max(1, int(item.get("line", 1)))
        except (TypeError, ValueError):
            line_number = 1

        name = item.get("name")

        try:
            created_at = datetime.fromtimestamp(
                float(item.get("createdAt")) / 1000,
                tz=timezone.utc,
            )
        except (TypeError, ValueError, OverflowError, OSError):
            created_at = datetime.now(timezone.utc)

        found[comment_id] = {
            "id": comment_id,
            "content": text.strip()[:500],
            "line_number": line_number,
            "guest_name": name[:40] if isinstance(name, str) and name else None,
            "created_at": created_at,
        }

    return found


async def _sync_comments(t: _Tracked) -> None:
    """Keeps the comments table in step with the comments in the shared document.
    The document stays the source of truth, because that is what syncs live between editors."""
    try:
        wanted = _read_comments(t.room.ydoc)
        wanted_ids = set(wanted)

        if t.mirrored_ids is not None and wanted_ids == t.mirrored_ids:
            return  # nothing changed since the last copy

        async with SessionLocal() as db:
            result = await db.execute(
                select(Comment.id).where(Comment.session_id == t.session_id)
            )
            existing = set(result.scalars().all())

            new_rows = [
                {**row, "session_id": t.session_id}
                for comment_id, row in wanted.items()
                if comment_id not in existing
            ]

            removed = existing - wanted_ids

            if new_rows:
                await db.execute(
                    insert(Comment)
                    .values(new_rows)
                    .on_conflict_do_nothing(index_elements=[Comment.id])
                )

            if removed:
                await db.execute(
                    delete(Comment).where(
                        Comment.session_id == t.session_id,
                        Comment.id.in_(list(removed)),
                    )
                )

            if new_rows or removed:
                await db.commit()

        t.mirrored_ids = wanted_ids

    except Exception:
        log.exception("Failed to copy comments to the database for session %s", t.slug)


def note_verified_user(session_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Remembers that this account was verified by the server in this session's live room."""
    for tracked in _active.values():
        if tracked.session_id == session_id:
            tracked.verified_users.add(user_id)


MAX_CHAT_PER_PASS = 500


def _read_chat(ydoc) -> dict[uuid.UUID, dict]:
    """The chat messages currently in the shared document, checked and cleaned."""
    try:
        raw = ydoc.get("chat", type=Array).to_py() or []
    except Exception:
        return {}

    found: dict[uuid.UUID, dict] = {}
    for item in raw[-MAX_CHAT_PER_PASS:]:
        if not isinstance(item, dict):
            continue
        try:
            message_id = uuid.UUID(str(item.get("id")))
        except ValueError:
            continue

        text = item.get("text")
        if not isinstance(text, str) or not text.strip():
            continue

        name = item.get("name")
        try:
            created_at = datetime.fromtimestamp(
                float(item.get("timestamp")) / 1000,
                tz=timezone.utc,
            )
        except (TypeError, ValueError, OverflowError, OSError):
            created_at = datetime.now(timezone.utc)

        claimed_user_id = None
        raw_user = item.get("userId")
        if isinstance(raw_user, str):
            try:
                claimed_user_id = uuid.UUID(raw_user)
            except ValueError:
                claimed_user_id = None

        found[message_id] = {
            "id": message_id,
            "content": text.strip()[:1000],
            "guest_name": name[:40] if isinstance(name, str) and name else None,
            "created_at": created_at,
            "claimed_user_id": claimed_user_id,
        }

    return found


async def _sync_chat(t: _Tracked) -> None:
    """Copies new chat messages into the chat_messages table. It only ever adds rows:
    the shared document keeps just the latest 200 messages, and the table keeps them all."""
    try:
        wanted = _read_chat(t.room.ydoc)
        known = t.mirrored_chat_ids
        new_ids = set(wanted) - (known or set())

        if known is not None and not new_ids:
            return  # nothing new since the last copy

        rows = []
        for message_id in new_ids:
            row = dict(wanted[message_id])
            claimed = row.pop("claimed_user_id", None)
            # Only trust an account the server has verified itself in this room
            row["user_id"] = claimed if claimed in t.verified_users else None
            row["session_id"] = t.session_id
            rows.append(row)

        if rows:
            async with SessionLocal() as db:
                await db.execute(
                    insert(ChatMessage)
                    .values(rows)
                    .on_conflict_do_nothing(index_elements=[ChatMessage.id])
                )
                await db.commit()

        t.mirrored_chat_ids = (known or set()) | set(wanted)

    except Exception:
        log.exception(
            "Failed to copy chat messages to the database for session %s",
            t.slug,
        )


async def _save(t: _Tracked, *, final: bool = False) -> None:
    try:
        state = t.room.ydoc.get_update()  # the complete current document state

        await save_state(t.session_id, state)
        await _maybe_auto_snapshot(t, state, final)
        await _sync_comments(t)
        await _sync_chat(t)

    except Exception:
        # Never let a failed save kill the room; the next change retries
        log.exception("Failed to save document for session %s", t.slug)


async def _saver(t: _Tracked) -> None:
    while t.dirty:
        await asyncio.sleep(SAVE_INTERVAL_SECONDS)
        t.dirty = False  # changes made from now on trigger another round
        await _save(t)


def _mark_dirty(t: _Tracked) -> None:
    t.dirty = True
    if t.task is None or t.task.done():
        t.task = asyncio.get_running_loop().create_task(_saver(t))


def _detach(t: _Tracked) -> None:
    if t.task and not t.task.done():
        t.task.cancel()

    try:
        if t.subscription is not None:
            t.room.ydoc.unobserve(t.subscription)
    except Exception:
        pass

    if _active.get(t.slug) is t:
        del _active[t.slug]


async def attach(room, slug: str, session_id: uuid.UUID) -> None:
    """Load saved state into a room (once) and start saving its changes."""
    async with _attach_lock:
        current = _active.get(slug)

        if current is not None and current.room is room:
            return  # already attached

        if current is not None:
            _detach(current)  # a stale room object for the same session

        state = await load_state(session_id)

        if state:
            room.ydoc.apply_update(state)  # merging is idempotent, so reloading is safe

        tracked = _Tracked(room, slug, session_id)
        tracked.last_snapshot_content = await _latest_snapshot_content(session_id)

        loop = asyncio.get_running_loop()

        def on_update(_event) -> None:
            loop.call_soon_threadsafe(_mark_dirty, tracked)

        # Observe AFTER loading, so the state we just loaded isn't re-saved immediately
        tracked.subscription = room.ydoc.observe(on_update)
        _active[slug] = tracked


async def release(room, slug: str) -> None:
    """Call when a client leaves. If the room is now empty, save right away and detach."""
    async with _attach_lock:
        t = _active.get(slug)

        if t is None or t.room is not room:
            return

        if len(room.clients) > 0:
            return  # others are still connected; the periodic saver covers it

        if t.task and not t.task.done():
            t.task.cancel()

        await _save(t, final=True)  # final=True also records a snapshot if the code changed
        _detach(t)


async def flush_all() -> None:
    """Save every active room (used at shutdown)."""
    for t in list(_active.values()):
        if t.task and not t.task.done():
            t.task.cancel()

        await _save(t, final=True)
        _detach(t)


async def discard_room(slug: str) -> None:
    """Forgets a live room without saving it, because its session is being deleted.
    Nothing more is written for it, so no data is brought back after the deletion."""
    async with _attach_lock:
        tracked = _active.get(slug)
        if tracked is not None:
            _detach(tracked)  # stops the periodic save and the change watcher