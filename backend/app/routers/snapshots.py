import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pycrdt import Doc, Text
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import get_accessible_session
from app.auth.dependencies import AuthUser, ensure_user_row, get_optional_user
from app.database import get_db
from app.models import CodingSession, Snapshot
from app.routers.sessions import get_owned_session
from app.schemas.snapshot import SnapshotCreate, SnapshotDetail, SnapshotMeta
from app.sync import persistence

router = APIRouter(prefix="/sessions/{slug}/snapshots", tags=["snapshots"])


def _meta(snapshot: Snapshot) -> SnapshotMeta:
    return SnapshotMeta(
        id=snapshot.id,
        label=snapshot.label,
        is_manual=snapshot.is_manual,
        created_at=snapshot.created_at,
        size=len(snapshot.content),
    )


async def _get_snapshot(db: AsyncSession, session_id: uuid.UUID, snapshot_id: uuid.UUID) -> Snapshot:
    result = await db.execute(
        select(Snapshot).where(Snapshot.id == snapshot_id, Snapshot.session_id == session_id)
    )
    snapshot = result.scalar_one_or_none()
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot


async def _creator_id(db: AsyncSession, user: AuthUser | None) -> uuid.UUID | None:
    """The verified account behind this request, or None for someone without an account."""
    if user is None:
        return None
    await ensure_user_row(db, user)
    return user.id


async def _current_state(slug: str, session_id: uuid.UUID) -> bytes:
    """The latest document state: from the live room if there is one, else from the database."""
    room = persistence.get_active_room(slug)
    if room is not None:
        return room.ydoc.get_update()
    saved = await persistence.load_state(session_id)
    return saved or Doc().get_update()


def _replace_text(doc: Doc, content: str) -> None:
    text = doc.get("monaco", type=Text)
    with doc.transaction():
        length = len(text)
        if length:
            del text[0:length]
        if content:
            text.insert(0, content)


async def _restore_content(slug: str, session_id: uuid.UUID, content: str) -> None:
    room = persistence.get_active_room(slug)
    if room is not None:
        _replace_text(room.ydoc, content)
        return

    # Nobody is connected: edit the saved document directly
    state = await persistence.load_state(session_id)
    doc = Doc()
    if state:
        doc.apply_update(state)
    _replace_text(doc, content)
    await persistence.save_state(session_id, doc.get_update())


@router.get("", response_model=list[SnapshotMeta])
async def list_snapshots(
    limit: int = Query(default=100, ge=1, le=200),
    session: CodingSession = Depends(get_accessible_session),
    db: AsyncSession = Depends(get_db),
):
    size = func.char_length(Snapshot.content).label("size")
    result = await db.execute(
        select(Snapshot.id, Snapshot.label, Snapshot.is_manual, Snapshot.created_at, size)
        .where(Snapshot.session_id == session.id)
        .order_by(Snapshot.created_at.desc())
        .limit(limit)
    )
    return [
        SnapshotMeta(
            id=row.id, label=row.label, is_manual=row.is_manual,
            created_at=row.created_at, size=row.size,
        )
        for row in result.all()
    ]


@router.get("/{snapshot_id}", response_model=SnapshotDetail)
async def get_snapshot(
    snapshot_id: uuid.UUID,
    session: CodingSession = Depends(get_accessible_session),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await _get_snapshot(db, session.id, snapshot_id)
    return SnapshotDetail(**_meta(snapshot).model_dump(), content=snapshot.content)


@router.post("", response_model=SnapshotMeta, status_code=201)
async def create_checkpoint(
    payload: SnapshotCreate,
    session: CodingSession = Depends(get_owned_session),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    state = await _current_state(session.slug, session.id)
    created_by = await _creator_id(db, user)
    snapshot = await persistence.add_snapshot(
        db, session.id, state, persistence.text_of_state(state), payload.label, True, created_by=created_by
    )
    return _meta(snapshot)


@router.post("/{snapshot_id}/restore", status_code=204)
async def restore_snapshot(
    snapshot_id: uuid.UUID,
    session: CodingSession = Depends(get_owned_session),
    user: AuthUser | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await _get_snapshot(db, session.id, snapshot_id)
    created_by = await _creator_id(db, user)

    
    state = await _current_state(session.slug, session.id)
    label = f"Before restoring '{snapshot.label}'" if snapshot.label else "Before restoring a version"
    await persistence.add_snapshot(
        db, session.id, state, persistence.text_of_state(state), label[:80], True, created_by=created_by
    )

    await _restore_content(session.slug, session.id, snapshot.content)
    return Response(status_code=204)