import uuid
from dataclasses import dataclass

import httpx
from fastapi import Depends, Header, HTTPException
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User


@dataclass
class AuthUser:
    id: uuid.UUID
    email: str | None


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Malformed Authorization header")
    return token.strip()


async def _verify_token(token: str) -> AuthUser:
    """Asks Supabase Auth who this token belongs to. Works for every signing-key setup."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=503, detail="Login isn't configured on the server")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Could not reach the login service")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired login")
    data = response.json()
    try:
        return AuthUser(id=uuid.UUID(data["id"]), email=data.get("email"))
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid login")


async def get_current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    """Dependency for routes that need a logged-in user."""
    token = _extract_bearer(authorization)
    if token is None:
        raise HTTPException(status_code=401, detail="Login required")
    return await _verify_token(token)


async def get_optional_user(authorization: str | None = Header(default=None)) -> AuthUser | None:
    """For routes that guests can use too. A missing or bad login just means 'guest'."""
    try:
        token = _extract_bearer(authorization)
        return await _verify_token(token) if token else None
    except HTTPException:
        return None


async def ensure_user_row(db: AsyncSession, user: AuthUser) -> None:
    """Makes sure the profile row exists. The signup trigger normally does this,
    but accounts created before the trigger existed would otherwise break foreign keys."""
    await db.execute(insert(User).values(id=user.id).on_conflict_do_nothing())
    await db.commit()

async def verify_access_token(token: str) -> AuthUser | None:
    """Like _verify_token, but a bad or unusable token just means 'not logged in'."""
    try:
        return await _verify_token(token)
    except HTTPException:
        return None