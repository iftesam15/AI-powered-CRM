"""Account Pydantic validation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AccountBase(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Account/Company name")
    industry: str | None = Field(default=None, max_length=100)
    size: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    owner_id: UUID | None = Field(default=None)

    @field_validator("website")
    @classmethod
    def validate_website(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        url = v.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            url = f"https://{url}"
        return url


class AccountCreate(AccountBase):
    """Shape for creating a new account."""

    pass


class AccountUpdate(BaseModel):
    """Shape for updating an existing account."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    industry: str | None = Field(default=None, max_length=100)
    size: str | None = Field(default=None, max_length=50)
    website: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    owner_id: UUID | None = Field(default=None)

    @field_validator("website")
    @classmethod
    def validate_website(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not v.strip():
            return None
        url = v.strip()
        if not (url.startswith("http://") or url.startswith("https://")):
            url = f"https://{url}"
        return url


class AccountRead(AccountBase):
    """Shape returned when reading an account record."""

    id: UUID
    tenant_id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountListFilters(BaseModel):
    """Filters for listing accounts."""

    search: str | None = None
    industry: str | None = None
    owner_id: UUID | None = None
