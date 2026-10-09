from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AuthUser, get_current_user
from app.database import get_db
from app.models import CodingSession, SessionDocument

router = APIRouter(prefix="/mysession", tags=["mysession"])


class MySession(BaseModel):
    slug: str
    title: str
    language: str
    is_persistent: bool
    has_password: bool
    created_at: datetime
    expires_at: datetime | None
    updated_at: datetime | None  


@router.get("/sessions", response_model=list[MySession])
async def my_sessions(
    user: AuthUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(CodingSession, SessionDocument.updated_at)
        .outerjoin(SessionDocument, SessionDocument.session_id == CodingSession.id)
        .where(CodingSession.owner_id == user.id)
        .where(or_(CodingSession.expires_at.is_(None), CodingSession.expires_at > now))
        .order_by(func.coalesce(SessionDocument.updated_at, CodingSession.created_at).desc())
        .limit(200)
    )
    return [
        MySession(
            slug=s.slug,
            title=s.title,
            language=s.language,
            is_persistent=s.is_persistent,
            has_password=s.password_hash is not None,
            created_at=s.created_at,
            expires_at=s.expires_at,
            updated_at=updated_at,
        )
        for s, updated_at in result.all()
    ]