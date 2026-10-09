from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Path, Request, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.owner_token import generate_owner_token, hash_owner_token, owner_token_matches
from app.auth.passwords import hash_password, join_limiter, verify_password
from app.database import get_db
from app.models import CodingSession
from app.schemas.session import (
    PasswordCheck,
    SessionCreate,
    SessionCreated,
    SessionPublic,
    SessionUpdate,
)
from app.utils.ids import generate_slug
from pydantic import BaseModel

from app.auth.dependencies import AuthUser, ensure_user_row, get_current_user, get_optional_user


router = APIRouter(prefix="/sessions", tags=["sessions"])

SlugPath = Path(pattern=r"^[A-Za-z0-9_-]{6,32}$")

EXPIRY_DELTAS = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


def _to_public(session: CodingSession) -> SessionPublic:
    return SessionPublic(
        slug=session.slug,
        title=session.title,
        language=session.language,
        guests_can_edit=session.guests_can_edit,
        is_persistent=session.is_persistent,
        has_password=session.password_hash is not None,
        expires_at=session.expires_at,
    )


async def _load_session(db: AsyncSession, slug: str) -> CodingSession:
    result = await db.execute(select(CodingSession).where(CodingSession.slug == slug))
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.expires_at and session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session has expired")
    return session


async def get_owned_session(
    slug: str = SlugPath,
    x_owner_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> CodingSession:
    """Dependency: loads the session only if the caller proves they own it."""
    session = await _load_session(db, slug)
    if not x_owner_token:
        raise HTTPException(status_code=401, detail="Owner token required")
    if not owner_token_matches(x_owner_token, session.owner_token_hash):
        raise HTTPException(status_code=403, detail="Only the session owner can do this")
    return session

@router.post("", response_model=SessionCreated, status_code=201)
async def create_session(
    payload: SessionCreate | None = None,
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    payload = payload or SessionCreate()
    token = generate_owner_token()

    owner_id = None
    if user is not None:
        await ensure_user_row(db, user)
        owner_id = user.id

    # Retry in the very unlikely case of a slug collision
    for _ in range(5):
        session = CodingSession(
            slug=generate_slug(),
            title=payload.title,
            language=payload.language,
            owner_token_hash=hash_owner_token(token),
            owner_id=owner_id,
        )
        db.add(session)
        try:
            await db.commit()
            break
        except IntegrityError:
            await db.rollback()
    else:
        raise HTTPException(status_code=500, detail="Could not create a session, please try again")

    return SessionCreated(
        slug=session.slug, title=session.title, language=session.language, owner_token=token
    )

@router.get("/{slug}", response_model=SessionPublic)
async def get_session(slug: str = SlugPath, db: AsyncSession = Depends(get_db)):
    return _to_public(await _load_session(db, slug))


@router.patch("/{slug}", response_model=SessionPublic)
async def update_session(
    payload: SessionUpdate,
    session: CodingSession = Depends(get_owned_session),
    db: AsyncSession = Depends(get_db),
):
    if payload.title is not None:
        session.title = payload.title

    if payload.remove_password:
        session.password_hash = None
    elif payload.password is not None:
        session.password_hash = await hash_password(payload.password)

    if payload.expiry == "never":
        session.is_persistent = True
        session.expires_at = None
    elif payload.expiry is not None:
        session.is_persistent = False
        session.expires_at = datetime.now(timezone.utc) + EXPIRY_DELTAS[payload.expiry]

    await db.commit()
    return _to_public(session)


@router.post("/{slug}/verify-password", status_code=204)
async def verify_session_password(
    payload: PasswordCheck,
    request: Request,
    slug: str = SlugPath,
    db: AsyncSession = Depends(get_db),
):
    """Lets the join page show 'wrong password' before opening the editor.
    The WebSocket checks the password again, and that check is the one that counts."""
    session = await _load_session(db, slug)
    if session.password_hash is None:
        return Response(status_code=204)

    key = f"{request.client.host if request.client else 'unknown'}:{slug}"
    if join_limiter.blocked(key):
        raise HTTPException(status_code=429, detail="Too many wrong attempts. Try again in a few minutes.")

    if not await verify_password(session.password_hash, payload.password):
        join_limiter.record_failure(key)
        raise HTTPException(status_code=401, detail="Wrong password")

    join_limiter.reset(key)
    return Response(status_code=204)

class OwnerTokenResponse(BaseModel):
    owner_token: str


@router.post("/{slug}/claim", status_code=204)
async def claim_session(
    session: CodingSession = Depends(get_owned_session),
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Attaches a session created as a guest to the logged-in account."""
    if session.owner_id is not None and session.owner_id != user.id:
        raise HTTPException(status_code=409, detail="This session already belongs to another account")
    if session.owner_id is None:
        await ensure_user_row(db, user)
        session.owner_id = user.id
        await db.commit()
    return Response(status_code=204)


@router.post("/{slug}/owner-token", response_model=OwnerTokenResponse)
async def recover_owner_token(
    slug: str = SlugPath,
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lets the owning account get owner controls on a new device. This issues a NEW token
    and invalidates the old one, because the server only ever stores a hash of it."""
    session = await _load_session(db, slug)
    if session.owner_id is None or session.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Only the account that owns this session can do this")

    token = generate_owner_token()
    session.owner_token_hash = hash_owner_token(token)
    await db.commit()
    return OwnerTokenResponse(owner_token=token)    