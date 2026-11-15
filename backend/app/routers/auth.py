from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import bearer, get_current_user
from app.core.security import (
    create_access_token, decode_token, hash_password, verify_password,
)
from app.db.session import get_db
from app.models.customer import Customer
from app.models.location import Location
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

INTERNAL_ROLES = {
    "SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER",
    "WAREHOUSE", "PACKING_WORKER", "DRIVER", "SUPPLY_CHAIN_MANAGER",
}
ALL_ROLES = INTERNAL_ROLES | {"CUSTOMER"}
# Only a super admin may create, edit or reset accounts that can themselves manage users.
ADMIN_ROLES = {"SUPER_ADMIN", "OPERATIONS_ADMIN"}
# These roles work at one location and need it to see their own queue.
STATION_ROLES = {"FREEZING_STATION_MANAGER", "PACKING_WORKER", "WAREHOUSE"}

# Checked against when the email is unknown, so timing does not reveal which emails exist.
_DUMMY_HASH = hash_password("not-a-real-password")


def _token_for(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role, user.token_version)
    )


def _locked_error(user: User) -> HTTPException:
    wait = max(1, int((user.locked_until - datetime.utcnow()).total_seconds()))
    return HTTPException(
        429, "Too many failed attempts. Try again later.",
        headers={"Retry-After": str(wait)},
    )


def _is_locked(user: User) -> bool:
    return bool(user.locked_until and user.locked_until > datetime.utcnow())


def _record_failure(db: Session, user: User) -> None:
    # Increment in SQL so parallel guesses cannot overwrite each other's count.
    db.query(User).filter(User.id == user.id).update(
        {User.failed_logins: User.failed_logins + 1}
    )
    db.commit()
    db.refresh(user)
    if user.failed_logins >= settings.login_max_failures:
        user.failed_logins = 0
        user.locked_until = datetime.utcnow() + timedelta(
            seconds=settings.login_lockout_seconds
        )
        db.commit()


def _record_success(db: Session, user: User) -> None:
    if user.failed_logins or user.locked_until:
        user.failed_logins = 0
        user.locked_until = None
        db.commit()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user:
        verify_password(payload.password, _DUMMY_HASH)
        raise HTTPException(401, "Invalid credentials")
    if _is_locked(user):
        raise _locked_error(user)
    if not verify_password(payload.password, user.password_hash):
        _record_failure(db, user)
        if _is_locked(user):
            raise _locked_error(user)
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(401, "Account inactive")
    _record_success(db, user)
    return _token_for(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(user: User = Depends(get_current_user)):
    """Swap a still-valid token for a fresh one, so active people stay signed in."""
    return _token_for(user)


@router.post("/logout", status_code=204)
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """End every session of this account: tokens issued so far stop working."""
    user.token_version += 1
    db.commit()


@router.post("/change-password", response_model=TokenResponse)
def change_password(
    payload: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if _is_locked(user):
        raise _locked_error(user)
    if not verify_password(payload.current_password, user.password_hash):
        # Wrong guesses here count toward the same lockout as sign-in.
        _record_failure(db, user)
        raise HTTPException(400, "Current password is incorrect")
    _record_success(db, user)
    user.password_hash = hash_password(payload.new_password)
    user.token_version += 1  # signs out every other session
    db.commit()
    return _token_for(user)


def _admin_from_token(db: Session, creds: HTTPAuthorizationCredentials | None) -> User | None:
    if not creds:
        return None
    try:
        tp = decode_token(creds.credentials)
    except PyJWTError:
        raise HTTPException(401, "Invalid admin token")
    admin = db.get(User, tp.get("sub"))
    if not admin or not admin.is_active or tp.get("ver", 0) != admin.token_version:
        raise HTTPException(401, "Invalid admin token")
    return admin


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if payload.role not in ALL_ROLES:
        raise HTTPException(400, f"Unknown role: {payload.role}")

    email = payload.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(409, "Email already registered")

    admin = _admin_from_token(db, creds)
    is_admin = bool(admin and admin.role in ("SUPER_ADMIN", "OPERATIONS_ADMIN"))
    customer_id: str | None = None

    if payload.role == "CUSTOMER":
        if payload.customer_id:
            # Joining an existing customer gives access to its orders, so only an admin may do it.
            if not is_admin:
                raise HTTPException(403, "Only an admin can add a user to an existing customer")
            cust = db.get(Customer, payload.customer_id)
            if not cust:
                raise HTTPException(404, "Customer not found")
            customer_id = cust.id
        elif payload.customer_name:
            # Public self-registration creates a new customer.
            cust = Customer(name=payload.customer_name)
            db.add(cust)
            db.flush()
            customer_id = cust.id
        else:
            raise HTTPException(
                400, "CUSTOMER registration requires customer_id or customer_name",
            )
    else:
        if not admin:
            raise HTTPException(401, "Internal users must be created by an admin")
        if not is_admin:
            raise HTTPException(403, "Only SUPER_ADMIN or OPERATIONS_ADMIN can register internal users")
        if payload.role in ADMIN_ROLES and admin.role != "SUPER_ADMIN":
            raise HTTPException(403, "Only a super admin can create admin accounts")
        if payload.location_id and not db.get(Location, payload.location_id):
            raise HTTPException(404, "Location not found")
        if payload.role in STATION_ROLES and not payload.location_id:
            raise HTTPException(400, f"{payload.role} needs a location_id")
        customer_id = payload.customer_id

    user = User(
        email=email,
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        location_id=payload.location_id,
        customer_id=customer_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    out = UserOut.model_validate(user)
    if user.customer_id:
        customer = db.get(Customer, user.customer_id)
        out.customer_name = customer.name if customer else None
    return out
