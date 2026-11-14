from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.delivery import DeliveryScan, DeliveryTask, GPSEvent
from app.models.order import Order
from app.models.rfid import RFIDTag
from app.models.user import User
from app.schemas.delivery import DeliveryScanIn, GPSIn
from app.services.scan import to_epcs

router = APIRouter(prefix="/api/deliveries", tags=["deliveries"])


@router.get("")
def list_my_tasks(user: User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    q = db.query(DeliveryTask)
    if user.role == "DRIVER":
        q = q.filter(DeliveryTask.driver_id == user.id)
    elif user.role not in ("SUPER_ADMIN", "OPERATIONS_ADMIN", "SUPPLY_CHAIN_MANAGER"):
        raise HTTPException(403, "Not allowed")
    rows = q.order_by(DeliveryTask.created_at.desc()).all()
    return [{"id": t.id, "dispatch_id": t.dispatch_id, "status": t.status,
             "driver_id": t.driver_id} for t in rows]


@router.post("/{task_id}/gps")
def record_gps(task_id: str, payload: GPSIn,
               user: User = Depends(require_roles("DRIVER", "OPERATIONS_ADMIN", "SUPER_ADMIN")),
               db: Session = Depends(get_db)):
    task = db.get(DeliveryTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    if user.role == "DRIVER" and task.driver_id != user.id:
        raise HTTPException(403, "Not your task")
    e = GPSEvent(
        task_id=task_id, recorded_at=datetime.utcnow(),
        latitude=payload.latitude, longitude=payload.longitude,
        accuracy_m=payload.accuracy_m,
    )
    db.add(e)
    db.commit()
    return {"id": e.id}


@router.post("/{task_id}/scans")
def scan_delivery(task_id: str, payload: DeliveryScanIn,
                  user: User = Depends(require_roles("DRIVER", "SUPER_ADMIN", "OPERATIONS_ADMIN")),
                  db: Session = Depends(get_db)):
    task = db.get(DeliveryTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    matched, unknown = [], []
    for epc in to_epcs(db, payload.epcs):
        tag = db.query(RFIDTag).filter(
            RFIDTag.epc == epc, RFIDTag.active == True).first()  # noqa: E712
        if not tag:
            unknown.append(epc)
            db.add(DeliveryScan(task_id=task_id, epc=epc))
            continue
        db.add(DeliveryScan(task_id=task_id, epc=epc, container_id=tag.container_id))
        matched.append(tag.container_id)
    db.commit()
    return {"matched_container_ids": matched, "unknown_epcs": unknown}
