import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DeliveryTask(Base):
    __tablename__ = "delivery_tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"task-{uuid.uuid4().hex[:8].upper()}")
    dispatch_id: Mapped[str] = mapped_column(String, ForeignKey("dispatches.id"), nullable=False, index=True)
    driver_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String, default="ASSIGNED")
    departed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GPSEvent(Base):
    __tablename__ = "gps_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"gps-{uuid.uuid4().hex[:8].upper()}")
    task_id: Mapped[str] = mapped_column(String, ForeignKey("delivery_tasks.id"), nullable=False, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)


class DeliveryScan(Base):
    __tablename__ = "delivery_scans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"dsc-{uuid.uuid4().hex[:8].upper()}")
    task_id: Mapped[str] = mapped_column(String, ForeignKey("delivery_tasks.id"), nullable=False, index=True)
    epc: Mapped[str] = mapped_column(String, nullable=False)
    container_id: Mapped[str | None] = mapped_column(String, ForeignKey("containers.id"), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
