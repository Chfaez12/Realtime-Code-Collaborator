import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CodingSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        CheckConstraint("char_length(slug) between 6 and 32", name="slug_length"),
        CheckConstraint("not (is_persistent and expires_at is not null)", name="persistent_no_expiry"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    slug: Mapped[str] = mapped_column(Text, unique=True)  
    title: Mapped[str] = mapped_column(Text, server_default="Untitled session")
    language: Mapped[str] = mapped_column(Text, server_default="javascript")

    guests_can_edit: Mapped[bool] = mapped_column(Boolean, server_default=text("true")) 
    is_persistent: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True)) 
    password_hash: Mapped[str | None] = mapped_column(Text)  

    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    owner_token_hash: Mapped[str | None] = mapped_column(Text) 

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())