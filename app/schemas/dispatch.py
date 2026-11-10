from pydantic import BaseModel, Field


class DispatchCreate(BaseModel):
    order_id: str
    packing_session_id: str
    driver_id: str | None = None
    vehicle_ref: str | None = None


class DispatchStatusUpdate(BaseModel):
    status: str


class DispatchVerifyIn(BaseModel):
    epcs: list[str] = Field(min_length=1)
