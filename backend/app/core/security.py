from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def check_password_policy(password: str) -> str:
    """Shared by registration, password change and the first-admin command."""
    if len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    # bcrypt 5 rejects secrets over 72 bytes instead of truncating them.
    if len(password.encode()) > 72:
        raise ValueError("password must be at most 72 bytes")
    return password


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, role: str, version: int = 0) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "ver": version,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=settings.jwt_ttl_seconds)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
