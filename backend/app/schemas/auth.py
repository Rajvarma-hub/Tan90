from pydantic import BaseModel, Field, field_validator

from app.core.security import check_password_policy


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
    customer_name: str | None = None

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str = Field(min_length=8, max_length=200)

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return check_password_policy(v)


class RegisterRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = Field(default="CUSTOMER")
    location_id: str | None = None
    customer_id: str | None = None
    customer_name: str | None = None

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return check_password_policy(v)
