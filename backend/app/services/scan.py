"""Resolve what a scanner read. A scan may be an RFID tag ID (EPC) or the
container code printed on the barcode label (e.g. CON-000016)."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.container import Container
from app.models.rfid import RFIDTag


def active_epc(db: Session, container_id: str) -> str | None:
    tag = db.query(RFIDTag).filter(
        RFIDTag.container_id == container_id, RFIDTag.active == True  # noqa: E712
    ).first()
    return tag.epc if tag else None


def resolve_scan(db: Session, code: str) -> Container | None:
    code = code.strip()
    if not code:
        return None
    tag = db.query(RFIDTag).filter(
        RFIDTag.epc == code, RFIDTag.active == True  # noqa: E712
    ).first()
    if tag:
        return db.get(Container, tag.container_id)
    return db.query(Container).filter(
        func.upper(Container.container_code) == code.upper()
    ).first()


def to_epcs(db: Session, codes: list[str]) -> list[str]:
    """Turn scanned codes into tag IDs so the existing EPC checks keep working.
    Codes that match nothing pass through unchanged and are reported as unknown."""
    out: list[str] = []
    for code in codes:
        code = code.strip()
        if not code:
            continue
        container = resolve_scan(db, code)
        epc = active_epc(db, container.id) if container else None
        value = epc or code
        if value not in out:
            out.append(value)
    return out
