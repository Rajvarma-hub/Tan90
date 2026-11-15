"""User management for admins: list, edit, reset a password, unlock."""
import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import check_password_policy, hash_password
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.customer import Customer
from app.models.location import Location
from app.models.user import User
from app.routers.auth import ADMIN_ROLES, ALL_ROLES, STATION_ROLES
from app.schemas.auth import UserOut

router = APIRouter(prefix="/api/admin/users", tags=["admin"])

admin_only = require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")


def can_manage_role(actor: User, role: str) -> bool:
    return actor.role == "SUPER_ADMIN" or role not in ADMIN_ROLES


class AdminUserOut(UserOut):
    is_active: bool
    locked: bool = False
    location_code: str | None = None
    location_name: str | None = None
    created_at: datetime | None = None


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = None
    location_id: str | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8, max_length=200)

    @field_validator("new_password")
    @classmethod
    def _policy(cls, v: str) -> str:
        return check_password_policy(v)


def _describe(db: Session, users: list[User]) -> list[AdminUserOut]:
    locations = {loc.id: loc for loc in db.query(Location).all()}
    names = {c.id: c.name for c in db.query(Customer).all()}
    now = datetime.utcnow()
    out = []
    for u in users:
        row = AdminUserOut.model_validate(u, from_attributes=True)
        row.customer_name = names.get(u.customer_id) if u.customer_id else None
        loc = locations.get(u.location_id) if u.location_id else None
        row.location_code = loc.code if loc else None
        row.location_name = loc.name if loc else None
        row.locked = bool(u.locked_until and u.locked_until > now)
        out.append(row)
    return out


def _get_target(db: Session, actor: User, user_id: str) -> User:
    target = db.get(User, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if not can_manage_role(actor, target.role):
        raise HTTPException(403, "Only a super admin can manage this account")
    return target


def _audit(db: Session, actor: User, target: User, action: str, details: dict) -> None:
    db.add(AuditLog(
        entity_type="user", entity_id=target.id, action=action,
        actor_id=actor.id, details_json=json.dumps(details),
    ))


@router.get("", response_model=list[AdminUserOut])
def list_users(user: User = Depends(admin_only), db: Session = Depends(get_db)):
    rows = db.query(User).order_by(User.is_active.desc(), User.role, User.full_name).all()
    return _describe(db, rows)


@router.patch("/{user_id}", response_model=AdminUserOut)
def update_user(user_id: str, payload: UserUpdate, actor: User = Depends(admin_only),
                db: Session = Depends(get_db)):
    target = _get_target(db, actor, user_id)
    changes = payload.model_dump(exclude_unset=True)
    # A null role, name or active flag is not a value; only the location may be cleared.
    changes = {k: v for k, v in changes.items() if v is not None or k == "location_id"}

    new_role = changes.get("role", target.role)
    if "role" in changes:
        if new_role not in ALL_ROLES:
            raise HTTPException(400, f"Unknown role: {new_role}")
        if not can_manage_role(actor, new_role):
            raise HTTPException(403, "Only a super admin can give this role")
        if (new_role == "CUSTOMER") != (target.role == "CUSTOMER"):
            raise HTTPException(400, "A customer account cannot become staff, or the reverse")
    if target.id == actor.id and ("role" in changes or changes.get("is_active") is False):
        raise HTTPException(400, "You cannot change your own role or deactivate yourself")

    location_id = changes.get("location_id", target.location_id)
    if location_id and not db.get(Location, location_id):
        raise HTTPException(404, "Location not found")
    if new_role in STATION_ROLES and not location_id:
        raise HTTPException(400, "This role needs a location")

    ends_sessions = (
        ("role" in changes and new_role != target.role)
        or changes.get("is_active") is False
    )
    for key, value in changes.items():
        setattr(target, key, value)
    if ends_sessions:
        target.token_version += 1  # a token carries the old role, so it must stop working
    _audit(db, actor, target, "USER_UPDATED", changes)
    db.commit()
    return _describe(db, [target])[0]


@router.post("/{user_id}/password", status_code=204)
def reset_password(user_id: str, payload: PasswordReset, actor: User = Depends(admin_only),
                   db: Session = Depends(get_db)):
    """Set a new password for someone who forgot theirs. Ends all of their sessions."""
    target = _get_target(db, actor, user_id)
    target.password_hash = hash_password(payload.new_password)
    target.token_version += 1
    target.failed_logins = 0
    target.locked_until = None
    _audit(db, actor, target, "USER_PASSWORD_RESET", {})
    db.commit()


@router.post("/{user_id}/unlock", status_code=204)
def unlock(user_id: str, actor: User = Depends(admin_only), db: Session = Depends(get_db)):
    target = _get_target(db, actor, user_id)
    target.failed_logins = 0
    target.locked_until = None
    _audit(db, actor, target, "USER_UNLOCKED", {})
    db.commit()
