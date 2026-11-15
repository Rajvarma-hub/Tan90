"""Shared fixtures. The API runs in-process against a throwaway seeded SQLite file."""
import os
import tempfile
import time
import uuid
from pathlib import Path

# Must be set before `app` is imported: the engine is created at import time.
# Set TEST_DATABASE_URL to run the suite against an empty PostgreSQL database.
_DB_DIR = tempfile.mkdtemp(prefix="tan90-test-")
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", f"sqlite:///{Path(_DB_DIR) / 'test.db'}"
)
os.environ["ENVIRONMENT"] = "development"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

PASSWORD = "password123"

USERS = {
    "admin": "admin@tan90.local",
    "ops": "ops@tan90.local",
    "fsblr": "fsblr@tan90.local",
    "fschn": "fschn@tan90.local",
    "packer": "packer1@tan90.local",
    "driver": "driver1@tan90.local",
    "blinkit": "blinkit@tan90.local",
    "hyperpure": "hyperpure@tan90.local",
}


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # entering the context runs startup and seeding
        yield c


@pytest.fixture(scope="session")
def api(client):
    def call(method, path, token=None, expect=200, body=None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        r = client.request(method, path, headers=headers, json=body)
        assert r.status_code == expect, (
            f"{method} {path} -> {r.status_code} (expected {expect}): {r.text[:300]}"
        )
        return r.json() if r.content else {}

    return call


@pytest.fixture(scope="session")
def tokens(api):
    return {
        role: api("POST", "/api/auth/login", body={"email": email, "password": PASSWORD})[
            "access_token"
        ]
        for role, email in USERS.items()
    }


@pytest.fixture(scope="session")
def stamp() -> int:
    """Millisecond timestamp for building unique codes."""
    return int(time.time() * 1000)


@pytest.fixture(scope="session")
def customer(api):
    """A freshly registered customer with its own token."""
    email = f"cust{uuid.uuid4().hex[:8]}@tan90.local"
    user = api("POST", "/api/auth/register", expect=201, body={
        "email": email, "password": PASSWORD, "full_name": "Test Customer",
        "role": "CUSTOMER", "customer_name": f"Test Co {email}",
    })
    token = api("POST", "/api/auth/login", body={"email": email, "password": PASSWORD})[
        "access_token"
    ]
    return {"email": email, "token": token, "customer_id": user["customer_id"]}
