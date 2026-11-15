from pydantic import BaseModel, Field


class ProductCreate(BaseModel):
    sku: str = Field(min_length=2, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    setpoint_c: float | None = None
    unit: str = "panel"
    reorder_level: int = Field(default=0, ge=0, le=1_000_000)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    setpoint_c: float | None = None
    is_active: bool | None = None
    reorder_level: int | None = Field(default=None, ge=0, le=1_000_000)


class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    setpoint_c: float | None
    unit: str
    is_active: bool
    reorder_level: int = 0

    class Config:
        from_attributes = True
