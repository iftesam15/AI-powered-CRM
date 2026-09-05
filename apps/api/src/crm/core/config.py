"""Environment-driven settings.

Read once at import and cached, so a misconfigured deploy fails at startup
rather than on the first request that happens to need a missing value.
"""

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, PostgresDsn, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "CRM API"
    environment: Literal["local", "test", "staging", "production"] = "local"
    debug: bool = False

    # CRM_ARCHITECTURE.md section 7: every business route lives under this prefix.
    api_v1_prefix: str = "/api/v1"

    database_url: PostgresDsn = Field(
        default=PostgresDsn("postgresql+asyncpg://postgres@localhost:5432/crm_dev"),
    )
    database_echo: bool = False
    database_pool_size: int = 5
    database_max_overflow: int = 10

    redis_url: str = "redis://localhost:6379/0"

    # The web app calls the API server side through its own proxy, so browsers
    # do not normally hit this origin directly. The list stays configurable for
    # local tools and for anyone pointing a client at the API in development.
    # NoDecode stops pydantic-settings from trying to JSON-parse the raw env
    # value, so the validator below receives the plain comma-separated string.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # Security & Auth
    jwt_secret_key: str = "dev-secret-key-change-in-production-min-32-chars-length"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    password_reset_token_expire_minutes: int = 60
    max_failed_login_attempts: int = 5
    lockout_duration_minutes: int = 15

    # SMTP / Mail
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@crm.local"
    smtp_from_name: str = "CRM"
    smtp_tls: bool = False
    app_url: str = "http://localhost:3000"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Accept a comma-separated string so a .env file can stay flat."""
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def sync_database_url(self) -> str:
        """Alembic and psql want a driver-less or psycopg URL, not asyncpg."""
        return str(self.database_url).replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
