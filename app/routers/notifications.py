from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def my_notifications(unread_only: bool = False,
                     user: User = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    conditions = [Notification.recipient_user_id == user.id]
    if user.role:
        conditions.append(and_(
            Notification.recipient_role == user.role,
            or_(Notification.recipient_location_id.is_(None),
                Notification.recipient_location_id == user.location_id),
        ))
    q = db.query(Notification).filter(or_(*conditions))
    if unread_only:
        q = q.filter(Notification.read_at.is_(None))
    rows = q.order_by(Notification.created_at.desc()).limit(100).all()
    return [
        {"id": r.id, "kind": r.kind, "title": r.title, "body": r.body,
         "reference_type": r.reference_type, "reference_id": r.reference_id,
         "read_at": r.read_at, "created_at": r.created_at}
        for r in rows
    ]


@router.post("/{notification_id}/read")
def mark_read(notification_id: str,
              user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    n = db.get(Notification, notification_id)
    if n:
        n.read_at = datetime.utcnow()
        db.commit()
    return {"ok": True}
