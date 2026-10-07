from urllib.parse import unquote

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.owner_token import owner_token_matches
from app.auth.passwords import join_limiter, verify_password
from app.database import get_db
from app.models import CodingSession
from app.routers.sessions import SlugPath, _load_session


async def get_accessible_session(
    request: Request,
    slug: str = SlugPath,
    x_owner_token: str | None = Header(default=None),
    x_session_password: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> CodingSession:
    """Dependency: the owner, or anyone with the room password (if there is one)."""
    session = await _load_session(db, slug)

    if x_owner_token and owner_token_matches(x_owner_token, session.owner_token_hash):
        return session
    if session.password_hash is None:
        return session

    key = f"{request.client.host if request.client else 'unknown'}:{slug}"
    if join_limiter.blocked(key):
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Try again in a few minutes.")
    if not x_session_password:
        raise HTTPException(status_code=401, detail="Password required")

    if await verify_password(session.password_hash, unquote(x_session_password)):
        join_limiter.reset(key)
        return session

    join_limiter.record_failure(key)
    raise HTTPException(status_code=401, detail="Wrong password")


async def check_access(
    session: CodingSession,
    owner_token: str | None,
    password: str | None,
    client_key: str,
) -> str | None:
    """Same rules as get_accessible_session. Returns an error message, or None if allowed."""
    if owner_token and owner_token_matches(owner_token, session.owner_token_hash):
        return None
    if session.password_hash is None:
        return None
    if join_limiter.blocked(client_key):
        return "Too many wrong attempts. Try again in a few minutes."
    if not password:
        return "Password required"
    if await verify_password(session.password_hash, password):
        join_limiter.reset(client_key)
        return None
    join_limiter.record_failure(client_key)
    return "Wrong password"