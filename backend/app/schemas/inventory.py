from pydantic import BaseModel, Field


class StockMovementIn(BaseModel):
    product_id: str = Field(min_length=1, max_length=64)
    location_id: str = Field(min_length=1, max_length=64)
    direction: str = Field(pattern="^(INWARD|OUTWARD)$")
    reason: str = Field(pattern="^(NEW_INVENTORY|INTERNAL_TRANSFER|DAMAGED|ADJUSTMENT)$")
    quantity: int = Field(ge=1, le=1_000_000)
    # Destination station — required for INTERNAL_TRANSFER.
    to_location_id: str | None = Field(default=None, max_length=64)
    # Free-text reference: challan / document number, supplier, etc.
    reference: str | None = Field(default=None, max_length=120)
