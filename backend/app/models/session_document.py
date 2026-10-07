import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class SessionDocument(Base):
    """The current live Yjs state of a session. One row per session, overwritten as it changes."""

    __tablename__ = "session_documents"

    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True
    )
    state: Mapped[bytes] = mapped_column(LargeBinary)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )