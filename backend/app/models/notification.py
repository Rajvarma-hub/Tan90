import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Notification(Base):
    """Role-scoped or user-scoped in-app notification.

    A row with `recipient_user_id` set is for that one user.
    A row with `recipient_role` set (and optionally `recipient_location_id`)
    is for every user matching that role/location.
    """
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user", "recipient_user_id", "read_at"),
        Index("ix_notifications_role", "recipient_role", "read_at"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"ntf-{uuid.uuid4().hex[:8].upper()}")
    recipient_user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    recipient_role: Mapped[str | None] = mapped_column(String, nullable=True)
    recipient_location_id: Mapped[str | None] = mapped_column(String, ForeignKey("locations.id"), nullable=True)

    kind: Mapped[str] = mapped_column(String, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    reference_type: Mapped[str | None] = mapped_column(String, nullable=True)
    reference_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
