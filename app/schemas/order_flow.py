from pydantic import BaseModel, Field


class ApproveIn(BaseModel):
    station_id: str = Field(min_length=1, max_length=64)


class DispatchIn(BaseModel):
    driver_id: str = Field(min_length=1, max_length=64)
    vehicle_ref: str = Field(min_length=1, max_length=64)
    epcs: list[str] = Field(min_length=1, max_length=500)


class VerifyQRIn(BaseModel):
    token: str = Field(min_length=1, max_length=500)


class ConfirmReceiptIn(BaseModel):
    received: list[str] = Field(default_factory=list, max_length=500)
    missing: list[str] = Field(default_factory=list, max_length=500)
    damaged: list[str] = Field(default_factory=list, max_length=500)
    notes: str | None = Field(default=None, max_length=1000)


class RequestReturnIn(BaseModel):
    container_ids: list[str] = Field(min_length=1, max_length=500)


class AssignReturnDriverIn(BaseModel):
    driver_id: str = Field(min_length=1, max_length=64)


class CollectReturnIn(BaseModel):
    epcs: list[str] = Field(min_length=1, max_length=500)


class InspectItemIn(BaseModel):
    container_id: str = Field(min_length=1, max_length=64)
    condition: str = Field(pattern="^(OK|DAMAGED|CONTAMINATED)$")
    contains_panels: bool = False
    notes: str | None = Field(default=None, max_length=500)


class InspectAndCloseIn(BaseModel):
    results: list[InspectItemIn] = Field(min_length=1, max_length=500)
