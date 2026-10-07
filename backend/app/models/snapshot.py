import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, LargeBinary, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Snapshot(Base):
    """A saved point in a session's history: automatic, or a named manual checkpoint."""

    __tablename__ = "snapshots"
    __table_args__ = (Index("ix_snapshots_session_created", "session_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("sessions.id", ondelete="CASCADE"))
    label: Mapped[str | None] = mapped_column(Text) 
    doc_state: Mapped[bytes] = mapped_column(LargeBinary)  
    content: Mapped[str] = mapped_column(Text, server_default="")
    is_manual: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())