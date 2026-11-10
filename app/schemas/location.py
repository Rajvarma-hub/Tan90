from pydantic import BaseModel, Field


class LocationCreate(BaseModel):
    code: str = Field(min_length=2, max_length=20)
    name: str = Field(min_length=1, max_length=200)
    kind: str = Field(pattern="^(WAREHOUSE|FREEZING_STATION)$")
    address: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    address: str | None = None
    is_active: bool | None = None


class LocationOut(BaseModel):
    id: str
    code: str
    name: str
    kind: str
    address: str | None
    is_active: bool

    class Config:
        from_attributes = True
