from pydantic import BaseModel, Field


class DeliveryScanIn(BaseModel):
    epcs: list[str] = Field(min_length=1, max_length=500)


class DeliveryStatusIn(BaseModel):
    status: str = Field(pattern="^(DEPARTED|ARRIVED)$")


class GPSIn(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=10000)
