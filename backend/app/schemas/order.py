from datetime import datetime
from pydantic import BaseModel, Field


class OrderItemIn(BaseModel):
    product_id: str = Field(min_length=1, max_length=64)
    quantity: int = Field(ge=1, le=10_000)


class OrderCreate(BaseModel):
    customer_id: str = Field(min_length=1, max_length=64)
    station_id: str | None = Field(default=None, max_length=64)
    destination: str | None = Field(default=None, max_length=500)
    expected_delivery_at: datetime | None = None
    items: list[OrderItemIn] = Field(min_length=1, max_length=100)


class OrderItemOut(BaseModel):
    id: str
    product_id: str
    quantity: int
    class Config:
        from_attributes = True


class OrderOut(BaseModel):
    id: str
    order_number: str
    customer_id: str
    station_id: str | None
    destination: str | None
    status: str
    expected_delivery_at: datetime | None
    created_at: datetime
    driver_id: str | None = None
    return_driver_id: str | None = None
    items: list[OrderItemOut] = []
    class Config:
        from_attributes = True
