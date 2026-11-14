from pydantic import BaseModel, Field


class PackingScanIn(BaseModel):
    epcs: list[str] = Field(min_length=1, max_length=500)


class PackingItemContentsIn(BaseModel):
    contents: list[dict] = Field(default_factory=list, max_length=100)


class PackingScanResult(BaseModel):
    added: list[dict]
    duplicates: list[str]
    unknown_epcs: list[str]
    unavailable: list[dict]
