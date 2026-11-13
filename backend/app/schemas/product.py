from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    sku: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    setpoint_c: float | None = None
    unit: str = "panel"


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    setpoint_c: float | None = None
    is_active: bool | None = None


class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    setpoint_c: float | None
    unit: str
    is_active: bool

    class Config:
        from_attributes = True
