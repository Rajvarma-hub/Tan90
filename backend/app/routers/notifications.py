from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, exists, func, or_
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification, NotificationRead
from app.models.user import User

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _addressed_to(user: User):
    """Sent to this person directly, or to their role (at their location, if one was named)."""
    return or_(
        Notification.recipient_user_id == user.id,
        and_(
            Notification.recipient_role == user.role,
            or_(Notification.recipient_location_id.is_(None),
                Notification.recipient_location_id == user.location_id),
        ),
    )


def _read_by(user: User):
    return or_(
        Notification.read_at.isnot(None),  # read marks from before reads were kept per person
        exists().where(
            NotificationRead.notification_id == Notification.id,
            NotificationRead.user_id == user.id,
        ),
    )


@router.get("")
def my_notifications(
    unread_only: bool = False,
    limit: int = Query(100, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Notification).filter(_addressed_to(user))
    if unread_only:
        q = q.filter(~_read_by(user))
    rows = q.order_by(Notification.created_at.desc()).limit(limit).all()
    read_at = {
        r.notification_id: r.read_at for r in db.query(NotificationRead).filter(
            NotificationRead.user_id == user.id,
            NotificationRead.notification_id.in_([n.id for n in rows]),
        ).all()
    }
    return [
        {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body,
         "reference_type": n.reference_type, "reference_id": n.reference_id,
         "read_at": read_at.get(n.id) or n.read_at, "created_at": n.created_at}
        for n in rows
    ]


@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    count = db.query(func.count(Notification.id)).filter(
        _addressed_to(user), ~_read_by(user)).scalar()
    return {"count": count or 0}


# Fixed paths come before /{notification_id}/read so they are not taken for an id.
@router.post("/read-all")
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = [i for (i,) in db.query(Notification.id).filter(
        _addressed_to(user), ~_read_by(user)).all()]
    now = datetime.utcnow()
    db.add_all(NotificationRead(notification_id=i, user_id=user.id, read_at=now) for i in ids)
    db.commit()
    return {"ok": True, "marked": len(ids)}


@router.post("/{notification_id}/read")
def mark_read(notification_id: str, user: User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    n = db.query(Notification).filter(
        Notification.id == notification_id, _addressed_to(user)).first()
    if not n:
        # Someone else's notification looks the same as one that does not exist.
        raise HTTPException(404, "Notification not found")
    if not db.get(NotificationRead, (n.id, user.id)):
        db.add(NotificationRead(notification_id=n.id, user_id=user.id))
        db.commit()
    return {"ok": True}
