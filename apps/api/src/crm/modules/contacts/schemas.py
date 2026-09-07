"""Contact Pydantic validation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ContactBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100, description="First name")
    last_name: str = Field(min_length=1, max_length=100, description="Last name")
    email: str | None = Field(default=None, max_length=255, description="Email address")
    phone: str | None = Field(default=None, max_length=50, description="Phone number")
    title: str | None = Field(default=None, max_length=100, description="Job title")
    account_id: UUID | None = Field(default=None, description="Linked account ID")
    owner_id: UUID | None = Field(default=None, description="Owner user ID")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        cleaned = v.strip().lower()
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Invalid email format")
        return cleaned


class ContactCreate(ContactBase):
    """Shape for creating a new contact."""

    pass


class ContactUpdate(BaseModel):
    """Shape for updating an existing contact."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    title: str | None = Field(default=None, max_length=100)
    account_id: UUID | None = Field(default=None)
    owner_id: UUID | None = Field(default=None)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if not v.strip():
            return None
        cleaned = v.strip().lower()
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Invalid email format")
        return cleaned


class AccountSummary(BaseModel):
    id: UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class ContactRead(ContactBase):
    """Shape returned when reading a contact record."""

    id: UUID
    tenant_id: UUID
    account_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContactDuplicateCheckResponse(BaseModel):
    is_duplicate: bool
    matching_count: int
    matching_contacts: list[ContactRead] = []
