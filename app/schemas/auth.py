from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    location_id: str | None
    customer_id: str | None

    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = Field(default="CUSTOMER")
    location_id: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None
