from pydantic import BaseModel, Field


class ReturnCreate(BaseModel):
    container_ids: list[str] = Field(min_length=1)


class ReturnCollectionIn(BaseModel):
    container_ids: list[str] = Field(min_length=1)


class ReturnScanIn(BaseModel):
    epcs: list[str] | None = None
    container_ids: list[str] | None = None


class InspectionItemIn(BaseModel):
    container_id: str
    condition: str
    contains_panels: bool = False
    notes: str | None = None


class ReturnInspectionIn(BaseModel):
    results: list[InspectionItemIn] = Field(min_length=1)
