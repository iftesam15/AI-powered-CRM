"""Tenant Pydantic validation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TenantBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    default_currency: str = Field(default="USD", min_length=3, max_length=3)
    locale: str = Field(default="en-US", max_length=20)


class TenantCreate(TenantBase):
    slug: str | None = Field(default=None, max_length=100)


class TenantUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    locale: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class TenantRead(TenantBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    slug: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
