"""SQLAlchemy base + engine. No session, no models — just the plumbing."""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


class Base(DeclarativeBase):
    pass


_connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url, connect_args=_connect_args, pool_pre_ping=True, future=True
)


def init_schema() -> None:
    """Create all tables. Safe to call repeatedly. Needs models imported."""
    import app.models  # noqa: F401
    Base.metadata.create_all(engine)
