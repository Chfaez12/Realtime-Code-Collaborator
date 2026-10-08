import asyncio
import logging
import re
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from pycrdt.websocket import WebsocketServer


from app.auth.owner_token import owner_token_matches
from app.auth.passwords import join_limiter, verify_password
from app.config import settings
from app.database import SessionLocal
from app.models import CodingSession
from app.services import participants
from app.sync import guard, persistence, registry
from app.sync.adapter import StarletteChannel

log = logging.getLogger("uvicorn.error")

router = APIRouter()

# One server for all rooms. It is started and stopped in main.py's lifespan.
websocket_server = WebsocketServer()

SLUG_RE = re.compile(r"^[A-Za-z0-9_-]{6,32}$")

# Custom close codes (4000-4999 are reserved for applications)
CLOSE_BAD_REQUEST = 4400
CLOSE_UNAUTHORIZED = 4401  # password required or wrong
CLOSE_FORBIDDEN = 4403
CLOSE_NOT_FOUND = 4404
CLOSE_EXPIRED = 4410

AUTH_TIMEOUT_SECONDS = 10
MAX_AUTH_MESSAGES = 6


@dataclass
class SessionRef:
    id: uuid.UUID
    owner_token_hash: str | None
    password_hash: str | None


async def _close(websocket: WebSocket, code: int | None = None) -> None:
    """Closes the socket, ignoring the error if the client has already gone away."""
    try:
        if code is None:
            await websocket.close()
        else:
            await websocket.close(code=code)
    except Exception:
        pass


async def _lookup_session(slug: str) -> tuple[str, SessionRef | None]:
    """Returns (state, ref) where state is 'ok', 'not_found' or 'expired'."""
    async with SessionLocal() as db:
        result = await db.execute(select(CodingSession).where(CodingSession.slug == slug))
        session = result.scalar_one_or_none()
        if session is None:
            return "not_found", None
        if session.expires_at and session.expires_at < datetime.now(timezone.utc):
            return "expired", None
        return "ok", SessionRef(
            id=session.id,
            owner_token_hash=session.owner_token_hash,
            password_hash=session.password_hash,
        )


async def _authenticate(
    websocket: WebSocket, channel: StarletteChannel, ref: SessionRef, slug: str
) -> bool:
    """Reads the client's leading auth messages (owner token, password, identity), which the
    browser sends before anything else. The first non-auth message is handed back to the
    channel. Returns True if this client may join the room.
    Raises WebSocketDisconnect if the client leaves before the handshake finishes."""
    password_ok = ref.password_hash is None  # unprotected rooms need no password
    client_ip = websocket.client.host if websocket.client else "unknown"
    limiter_key = f"{client_ip}:{slug}"

    try:
        for _ in range(MAX_AUTH_MESSAGES + 1):
            message = await asyncio.wait_for(websocket.receive_bytes(), timeout=AUTH_TIMEOUT_SECONDS)
            if not message:
                continue
            kind = message[0]

            if kind == guard.MSG_OWNER_AUTH:
                token = guard.parse_auth_string(message)
                if token and owner_token_matches(token, ref.owner_token_hash):
                    channel.is_owner = True
                continue

            if kind == guard.MSG_PASSWORD:
                supplied = guard.parse_auth_string(message)
                if supplied is not None and not password_ok and not join_limiter.blocked(limiter_key):
                    if await verify_password(ref.password_hash, supplied):
                        password_ok = True
                        join_limiter.reset(limiter_key)
                    else:
                        join_limiter.record_failure(limiter_key)
                continue

            if kind == guard.MSG_IDENTITY:
                channel.identity = guard.parse_identity(message)
                continue

            channel.stash(message)  # the first real message; the room still needs it
            break
    except WebSocketDisconnect:
        raise  # the client is gone, so the caller should just stop
    except Exception:
        # Timeout or a malformed frame: decide with what we have
        pass

    return channel.is_owner or password_ok


async def _record_join(channel: StarletteChannel, room, session_id: uuid.UUID) -> None:
    """Writes a row in the participants table for whoever just connected."""
    identity = channel.identity
    if identity is None:
        return  # no identity yet; it gets recorded when the client sends it
    if channel.is_owner:
        role = "owner"
    else:
        role = "editor" if guard.room_allows_guest_edits(room) else "viewer"
    await participants.record_participant(
        session_id,
        role=role,
        name=identity.get("name"),
        access_token=identity.get("token"),
    )


@router.websocket("/ws/{slug}")
async def sync_endpoint(websocket: WebSocket, slug: str):
    # Browsers always send Origin. Reject pages from other sites (cross-site hijacking).
    origin = websocket.headers.get("origin")
    if origin is not None and origin != settings.frontend_origin:
        await _close(websocket, CLOSE_FORBIDDEN)
        return

    # Accept first, then close with a code, so the client can see WHY it was refused
    await websocket.accept()

    if not SLUG_RE.match(slug):
        await _close(websocket, CLOSE_BAD_REQUEST)
        return

    state, ref = await _lookup_session(slug)
    if state == "not_found":
        await _close(websocket, CLOSE_NOT_FOUND)
        return
    if state == "expired":
        await _close(websocket, CLOSE_EXPIRED)
        return

    channel = StarletteChannel(websocket, slug, owner_token_hash=ref.owner_token_hash)
    try:
        allowed = await _authenticate(websocket, channel, ref, slug)
    except WebSocketDisconnect:
        return  # left before finishing the handshake (page reload, or React StrictMode in dev)
    if not allowed:
        log.info("Refused a connection to session %s: missing or wrong password", slug)
        await _close(websocket, CLOSE_UNAUTHORIZED)
        return

    room = None
    registry.add(slug, channel)
    try:
        # get_room returns the existing room or creates it; serve() below reuses the same one
        room = await websocket_server.get_room(slug)
        channel.room = room
        await persistence.attach(room, slug, ref.id)

        # Record who joined. If the identity message hasn't arrived yet, it is recorded when it does.
        participants.spawn(_record_join(channel, room, ref.id))
        channel.on_identity = lambda ch: _record_join(ch, room, ref.id)

        await websocket_server.serve(channel)
    except WebSocketDisconnect:
        pass
    finally:
        registry.remove(slug, channel)
        if room is not None:
            await persistence.release(room, slug)
        await _close(websocket)