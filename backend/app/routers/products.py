import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
def list_products(
    active_only: bool = True,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Product)
    if active_only:
        q = q.filter(Product.is_active == True)  # noqa: E712
    return q.order_by(Product.sku).all()


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    return p


@router.post("", response_model=ProductOut, status_code=201)
def create_product(
    payload: ProductCreate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    if db.query(Product).filter(Product.sku == payload.sku).first():
        raise HTTPException(409, f"SKU {payload.sku} already exists")

    p = Product(
        sku=payload.sku, name=payload.name,
        setpoint_c=payload.setpoint_c, unit=payload.unit,
        is_active=True,
    )
    db.add(p)
    db.flush()
    db.add(AuditLog(
        entity_type="product", entity_id=p.id, action="PRODUCT_CREATED",
        actor_id=user.id, details_json=json.dumps({"sku": p.sku}),
    ))
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str,
    payload: ProductUpdate,
    user: User = Depends(require_roles("SUPER_ADMIN", "OPERATIONS_ADMIN")),
    db: Session = Depends(get_db),
):
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(404, "Product not found")
    changed = payload.model_dump(exclude_unset=True)
    for k, v in changed.items():
        setattr(p, k, v)
    db.add(AuditLog(
        entity_type="product", entity_id=p.id, action="PRODUCT_UPDATED",
        actor_id=user.id, details_json=json.dumps(changed),
    ))
    db.commit()
    db.refresh(p)
    return p
