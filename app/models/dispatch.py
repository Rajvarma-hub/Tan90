import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Dispatch(Base):
    __tablename__ = "dispatches"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"dsp-{uuid.uuid4().hex[:8].upper()}")
    order_id: Mapped[str] = mapped_column(String, ForeignKey("orders.id"), nullable=False, index=True)
    packing_session_id: Mapped[str] = mapped_column(String, ForeignKey("packing_sessions.id"), nullable=False)
    driver_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    vehicle_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="PENDING")
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class DispatchItem(Base):
    __tablename__ = "dispatch_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"di-{uuid.uuid4().hex[:8].upper()}")
    dispatch_id: Mapped[str] = mapped_column(String, ForeignKey("dispatches.id"), nullable=False, index=True)
    container_id: Mapped[str] = mapped_column(String, ForeignKey("containers.id"), nullable=False)
