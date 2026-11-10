import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PackingSession(Base):
    __tablename__ = "packing_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"ps-{uuid.uuid4().hex[:8].upper()}")
    order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.id"), nullable=False, index=True)
    station_id: Mapped[str] = mapped_column(String, ForeignKey("locations.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="OPEN")
    opened_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list["PackingItem"]] = relationship(
        back_populates="session", cascade="all, delete-orphan", lazy="selectin"
    )


class PackingItem(Base):
    __tablename__ = "packing_items"
    __table_args__ = (UniqueConstraint("session_id", "container_id", name="uq_ps_container"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"pi-{uuid.uuid4().hex[:8].upper()}")
    session_id: Mapped[str] = mapped_column(String, ForeignKey("packing_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    container_id: Mapped[str] = mapped_column(String, ForeignKey("containers.id"), nullable=False)
    contents_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")

    session: Mapped[PackingSession] = relationship(back_populates="items")
