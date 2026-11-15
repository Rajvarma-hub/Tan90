from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.core.security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    if not creds:
        raise HTTPException(401, "Missing bearer token")
    try:
        payload = decode_token(creds.credentials)
    except PyJWTError:
        raise HTTPException(401, "Invalid or expired token")
    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(401, "User not found or inactive")
    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(401, "Session ended; sign in again")
    return user


def require_roles(*roles: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Insufficient permissions")
        return user
    return _dep


# Customers and drivers only ever see their own orders and containers. Anything that
# exposes the wider operation (all containers, stock, other stations' orders) is staff-only.
EXTERNAL_ROLES = ("CUSTOMER", "DRIVER")


def require_staff(user: User = Depends(get_current_user)) -> User:
    if user.role in EXTERNAL_ROLES:
        raise HTTPException(403, "Insufficient permissions")
    return user
