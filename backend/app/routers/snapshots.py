import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.access import get_accessible_session
from app.database import get_db
from app.models import CodingSession, Snapshot
from app.routers.sessions import get_owned_session
from app.schemas.snapshot import SnapshotCreate, SnapshotDetail, SnapshotMeta
from app.services import snapshot_service
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
    db: AsyncSession = Depends(get_db),
):
    state = await snapshot_service.current_state(session.slug, session.id)
    snapshot = await persistence.add_snapshot(
        db, session.id, state, persistence.text_of_state(state), payload.label, True
    )
    return _meta(snapshot)


@router.post("/{snapshot_id}/restore", status_code=204)
async def restore_snapshot(
    snapshot_id: uuid.UUID,
    session: CodingSession = Depends(get_owned_session),
    db: AsyncSession = Depends(get_db),
):
    snapshot = await _get_snapshot(db, session.id, snapshot_id)

    state = await snapshot_service.current_state(session.slug, session.id)
    label = f"Before restoring '{snapshot.label}'" if snapshot.label else "Before restoring a version"
    await persistence.add_snapshot(
        db, session.id, state, persistence.text_of_state(state), label[:80], True
    )

    await snapshot_service.restore_content(session.slug, session.id, snapshot.content)
    return Response(status_code=204)