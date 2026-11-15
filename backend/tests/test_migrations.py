from alembic import command
from alembic.config import Config

from app.db.base import ALEMBIC_INI


def test_models_match_migrations(client):
    """Fails when a model changes without a new migration (`alembic revision --autogenerate`)."""
    cfg = Config(str(ALEMBIC_INI))
    cfg.attributes["embedded"] = True
    command.check(cfg)
