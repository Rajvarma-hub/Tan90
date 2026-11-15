"""The first-admin command, run the way a production deploy runs it."""
import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.cli import create_admin

BACKEND = Path(__file__).resolve().parents[1]


def _run(args, env):
    return subprocess.run(
        [sys.executable, *args], cwd=BACKEND, env=env,
        capture_output=True, text=True, timeout=120,
    )


@pytest.fixture
def prod_env(tmp_path):
    env = {
        **os.environ,
        "ENVIRONMENT": "production",
        "JWT_SECRET": "x" * 40,
        "DATABASE_URL": f"sqlite:///{tmp_path / 'prod.db'}",
        "ADMIN_PASSWORD": "a-strong-password",
    }
    # A developer's .env.local must not leak into the subprocess.
    env.pop("TEST_DATABASE_URL", None)
    return env


def test_create_admin_on_empty_production_database(prod_env):
    cli = ["-m", "app.cli", "create-admin", "--email", "Boss@Example.com", "--name", "Boss"]

    # Production refuses to start on an unmigrated database.
    r = _run(cli, prod_env)
    assert r.returncode == 1 and "alembic upgrade head" in r.stderr

    assert _run(["-m", "alembic", "upgrade", "head"], prod_env).returncode == 0
    r = _run(cli, prod_env)
    assert r.returncode == 0, r.stderr
    assert "boss@example.com" in r.stdout

    # The command works once; the next run must not add a second admin.
    r = _run(cli, prod_env)
    assert r.returncode == 1 and "already exists" in r.stderr


def test_create_admin_rejects_weak_password(prod_env):
    prod_env["ADMIN_PASSWORD"] = "short"
    r = _run(["-m", "app.cli", "create-admin", "--email", "a@b.co"], prod_env)
    assert r.returncode == 1 and "at least 8" in r.stderr


def test_create_admin_refuses_when_admin_exists(client):
    # The seeded development database already has a super admin.
    with pytest.raises(ValueError, match="already exists"):
        create_admin("another@tan90.local", "Another", "password123")
