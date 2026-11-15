from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_JWT_SECRET = "change-me-to-a-long-random-string"
# One env file at the repo root configures both the portal and the API.
ENV_FILE = Path(__file__).resolve().parents[3] / ".env.local"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    # "production" turns on the safety checks below.
    environment: str = "development"
    database_url: str = "sqlite:///./tan90.db"
    jwt_secret: str = DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    # A token lives one hour; the portal renews it while someone is active.
    jwt_ttl_seconds: int = 3_600
    # After this many wrong passwords in a row an account is locked for a while.
    login_max_failures: int = 5
    login_lockout_seconds: int = 900
    # Comma-separated browser origins allowed to call the API.
    cors_origins: str = "http://localhost:3000"

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, v: str) -> str:
        # Hosts hand out plain postgres:// URLs; SQLAlchemy needs the driver named.
        for prefix in ("postgres://", "postgresql://"):
            if v.startswith(prefix):
                return "postgresql+psycopg://" + v[len(prefix):]
        return v

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def _require_real_secret_in_production(self) -> "Settings":
        if self.is_production and (
            self.jwt_secret == DEV_JWT_SECRET or len(self.jwt_secret) < 32
        ):
            raise ValueError(
                "JWT_SECRET must be a random string of 32+ characters when ENVIRONMENT=production"
            )
        return self


settings = Settings()
