from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.core.deps import bearer, get_current_user
from app.core.security import (
    create_access_token, decode_token, hash_password, verify_password,
)
from app.db.session import get_db
from app.models.customer import Customer
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

INTERNAL_ROLES = {
    "SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER",
    "WAREHOUSE", "PACKING_WORKER", "DRIVER", "SUPPLY_CHAIN_MANAGER",
}
ALL_ROLES = INTERNAL_ROLES | {"CUSTOMER"}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    if not user.is_active:
        raise HTTPException(401, "Account inactive")
    return TokenResponse(access_token=create_access_token(user.id, user.role))


@router.post("/register", response_model=UserOut, status_code=201)
def register(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if payload.role not in ALL_ROLES:
        raise HTTPException(400, f"Unknown role: {payload.role}")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(409, "Email already registered")

    customer_id: str | None = None

    if payload.role == "CUSTOMER":
        # Public path: customer self-registration.
        # Link to existing customer, or create one from `customer_name`.
        if payload.customer_id:
            cust = db.get(Customer, payload.customer_id)
            if not cust:
                raise HTTPException(404, "Customer not found")
            customer_id = cust.id
        elif payload.customer_name:
            cust = Customer(name=payload.customer_name)
            db.add(cust)
            db.flush()
            customer_id = cust.id
        else:
            raise HTTPException(
                400, "CUSTOMER registration requires customer_id or customer_name",
            )
    else:
        # Internal path: must be authenticated as admin.
        if not creds:
            raise HTTPException(401, "Internal users must be created by an admin")
        try:
            tp = decode_token(creds.credentials)
        except PyJWTError:
            raise HTTPException(401, "Invalid admin token")
        admin = db.get(User, tp.get("sub"))
        if not admin or admin.role not in ("SUPER_ADMIN", "OPERATIONS_ADMIN"):
            raise HTTPException(403, "Only SUPER_ADMIN or OPERATIONS_ADMIN can register internal users")
        customer_id = payload.customer_id

    user = User(
        email=payload.email,
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
def me(user: User = Depends(get_current_user)):
    return user
