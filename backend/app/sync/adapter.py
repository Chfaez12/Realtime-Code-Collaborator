import logging
from collections.abc import Awaitable, Callable

from fastapi import WebSocket

from app.auth.owner_token import owner_token_matches
from app.services.participants import spawn
from app.sync import guard

log = logging.getLogger("uvicorn.error")

MAX_MESSAGE_BYTES = 1_000_000


class StarletteChannel:
    """Adapts a FastAPI WebSocket to what pycrdt-websocket expects, and enforces
    permissions on everything the client sends."""

    def __init__(self, websocket: WebSocket, room_name: str, *, owner_token_hash: str | None):
        self._ws = websocket
        self._room_name = room_name
        self._owner_token_hash = owner_token_hash
        self._pending: list[bytes] = []  # messages read during the join handshake
        self.room = None  # set once the connection is allowed into the room
        self.is_owner = False
        self.identity: dict | None = None  # display name and login token, once the client has sent them
        self.on_identity: Callable[["StarletteChannel"], Awaitable[None]] | None = None

    @property
    def path(self) -> str:
        # pycrdt-websocket uses this as the room name, so we pass the session slug
        return self._room_name

    def stash(self, message: bytes) -> None:
        """Hands back a message the handshake read, so the room still receives it."""
        self._pending.append(message)

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        try:
            return await self.recv()
        except Exception:
            raise StopAsyncIteration()

    async def send(self, message: bytes) -> None:
        try:
            await self._ws.send_bytes(message)
        except Exception:
            # The client disconnected mid-send. Ignore it so one dead
            # connection can't take down the whole room.
            pass

    def _guest_update_allowed(self, update: bytes) -> bool:
        try:
            if guard.room_allows_guest_edits(self.room):
                return True
            return not guard.update_touches_protected(self.room, update)
        except Exception:
            # Fail closed: if we can't validate it, we don't accept it
            log.exception("Could not validate an update, rejecting it")
            return False

    async def _next_message(self) -> bytes:
        if self._pending:
            return self._pending.pop(0)
        return await self._ws.receive_bytes()

    async def recv(self) -> bytes:
        while True:
            message = await self._next_message()
            if len(message) > MAX_MESSAGE_BYTES:
                raise ValueError("Message too large")  # ends this connection
            if not message:
                continue

            kind = message[0]

            # Auth messages never reach the room. The password is only checked at join time.
            if kind == guard.MSG_OWNER_AUTH:
                token = guard.parse_auth_string(message)
                if token and owner_token_matches(token, self._owner_token_hash):
                    self.is_owner = True
                continue
            if kind == guard.MSG_PASSWORD:
                continue

            # Who this is. It can arrive after the join, so it may have to be recorded now.
            if kind == guard.MSG_IDENTITY:
                self.identity = guard.parse_identity(message)
                if self.on_identity is not None and self.identity is not None:
                    spawn(self.on_identity(self))
                continue

            if kind == guard.MSG_SYNC and not self.is_owner:
                try:
                    update = guard.extract_update(message)
                except ValueError:
                    continue  # malformed, drop it
                if update is not None and not self._guest_update_allowed(update):
                    log.info("Dropped a blocked edit in session %s", self._room_name)
                    continue

            return message