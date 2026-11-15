"""SQLAlchemy base + engine. No session, no models — just the plumbing."""

from pathlib import Path

from sqlalchemy import create_engine, inspect
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


ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"


def init_schema() -> None:
    """Bring the schema to the latest migration. Safe to call repeatedly.

    Development migrates on startup. Production only checks, so a deploy runs
    `alembic upgrade head` once instead of every worker racing to migrate.
    """
    from alembic import command
    from alembic.config import Config
    from alembic.runtime.migration import MigrationContext
    from alembic.script import ScriptDirectory

    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["embedded"] = True
    head = ScriptDirectory.from_config(cfg).get_current_head()

    with engine.connect() as conn:
        current = MigrationContext.configure(conn).get_current_revision()
        has_tables = bool(inspect(conn).get_table_names())

    if settings.is_production:
        if current != head:
            raise RuntimeError(
                f"Database is at revision {current}, expected {head}. Run `alembic upgrade head`."
            )
        return

    if current is None and has_tables:
        # A development database built before migrations existed.
        command.stamp(cfg, "head")
    command.upgrade(cfg, "head")
