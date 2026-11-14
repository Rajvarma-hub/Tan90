import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RFIDTag(Base):
    __tablename__ = "rfid_tags"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"tag-{uuid.uuid4().hex[:8].upper()}")
    epc: Mapped[str] = mapped_column(String, nullable=False, index=True)
    container_id: Mapped[str] = mapped_column(String, ForeignKey("containers.id"), nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    replaced_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RFIDScanSession(Base):
    __tablename__ = "rfid_scan_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"scan-{uuid.uuid4().hex[:8].upper()}")
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    reference_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    actor_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    reader_code: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="OPEN")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class RFIDScanEvent(Base):
    __tablename__ = "rfid_scan_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: f"evt-{uuid.uuid4().hex[:8].upper()}")
    session_id: Mapped[str] = mapped_column(String, ForeignKey("rfid_scan_sessions.id"), nullable=False, index=True)
    epc: Mapped[str] = mapped_column(String, nullable=False, index=True)
    container_id: Mapped[str | None] = mapped_column(String, ForeignKey("containers.id"), nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
