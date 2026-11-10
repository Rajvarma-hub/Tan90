from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.order import Order
from app.models.user import User

router = APIRouter(prefix="/api/returns", tags=["returns"])


@router.get("")
def list_returns(user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    q = db.query(Order).filter(Order.return_requested_at.isnot(None))
    if user.role == "CUSTOMER":
        q = q.filter(Order.customer_id == user.customer_id)
    elif user.role in ("FREEZING_STATION_MANAGER", "PACKING_WORKER"):
        q = q.filter(Order.station_id == user.location_id)
    rows = q.order_by(Order.return_requested_at.desc()).all()
    return [{"order_id": r.id, "order_number": r.order_number,
             "status": r.status, "return_requested_at": r.return_requested_at,
             "return_driver_id": r.return_driver_id} for r in rows]
