from pydantic import BaseModel, Field


class ContainerRegisterRequest(BaseModel):
    epc: str = Field(min_length=4, max_length=64)
    container_type_code: str = Field(min_length=3, max_length=16,
                                     description="One of SHIP-15, SHIP-20, SHIP-40, SHIP-60, SHIP-100, ICE-50, ICE-100, BAG-20")
    location_id: str
    # capacity is NOT accepted here — it is derived from container_type_code


class ContainerOut(BaseModel):
    id: str
    container_code: str
    container_type: str
    capacity_litres: float
    status: str
    current_location_id: str | None
    current_customer_id: str | None
    epc: str | None = None
    # Resolved for the portal
    location_code: str | None = None
    location_name: str | None = None
    customer_name: str | None = None
    # The order this container is packed for / out on, if any.
    current_order: dict | None = None


class ReplaceTagRequest(BaseModel):
    new_epc: str = Field(min_length=4, max_length=64)
    reason: str | None = None
