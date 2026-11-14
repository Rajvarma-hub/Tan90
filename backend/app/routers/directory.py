"""Read-only lookups the portal needs to label things: customers and staff."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.customer import Customer
from app.models.user import User

router = APIRouter(prefix="/api", tags=["directory"])

INTERNAL = (
    "SUPER_ADMIN", "OPERATIONS_ADMIN", "FREEZING_STATION_MANAGER",
    "WAREHOUSE", "PACKING_WORKER", "SUPPLY_CHAIN_MANAGER",
)


@router.get("/customers")
def list_customers(user: User = Depends(require_roles(*INTERNAL)),
                   db: Session = Depends(get_db)):
    return [
        {"id": c.id, "name": c.name, "contact_email": c.contact_email,
         "contact_phone": c.contact_phone, "address": c.address}
        for c in db.query(Customer).order_by(Customer.name).all()
    ]


@router.get("/users")
def list_users(role: str | None = None,
               user: User = Depends(require_roles(*INTERNAL)),
               db: Session = Depends(get_db)):
    q = db.query(User).filter(User.is_active == True)  # noqa: E712
    if role:
        q = q.filter(User.role == role)
    return [
        {"id": u.id, "full_name": u.full_name, "email": u.email, "role": u.role,
         "location_id": u.location_id, "customer_id": u.customer_id}
        for u in q.order_by(User.full_name).all()
    ]
