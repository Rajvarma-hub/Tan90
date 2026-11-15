"""Operator commands. Run from the backend folder: `python -m app.cli --help`."""
import argparse
import getpass
import os
import sys

from app.core.security import check_password_policy, hash_password
from app.db.base import init_schema
from app.db.session import SessionLocal
import app.models  # noqa: F401  (registers every table so foreign keys resolve)
from app.models.user import User


def create_admin(email: str, full_name: str, password: str) -> User:
    """Create the first SUPER_ADMIN. Refuses once any super admin exists."""
    email = email.strip().lower()
    if "@" not in email:
        raise ValueError("enter a valid email address")
    check_password_policy(password)
    init_schema()
    with SessionLocal() as db:
        if db.query(User).filter(User.role == "SUPER_ADMIN").first():
            raise ValueError(
                "a super admin already exists; sign in and add users from the portal"
            )
        if db.query(User).filter(User.email == email).first():
            raise ValueError(f"{email} is already registered")
        user = User(
            email=email, full_name=full_name.strip() or "Administrator",
            password_hash=hash_password(password), role="SUPER_ADMIN",
        )
        db.add(user)
        db.commit()
        return user


def _read_password() -> str:
    # The environment variable lets deploy scripts run this without a terminal.
    env = os.environ.get("ADMIN_PASSWORD")
    if env:
        return env
    first = getpass.getpass("Password: ")
    if first != getpass.getpass("Repeat password: "):
        raise ValueError("passwords do not match")
    return first


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("create-admin", help="create the first super admin")
    p.add_argument("--email", default=os.environ.get("ADMIN_EMAIL"))
    p.add_argument("--name", default=os.environ.get("ADMIN_NAME", "Administrator"))
    args = parser.parse_args(argv)

    try:
        if not args.email:
            raise ValueError("pass --email or set ADMIN_EMAIL")
        user = create_admin(args.email, args.name, _read_password())
    except (ValueError, RuntimeError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    print(f"Created super admin {user.email}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
