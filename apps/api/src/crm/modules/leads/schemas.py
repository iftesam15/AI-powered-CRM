"""Lead Pydantic validation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LeadBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100, description="First name")
    last_name: str = Field(min_length=1, max_length=100, description="Last name")
    email: str | None = Field(default=None, max_length=255, description="Email address")
    phone: str | None = Field(default=None, max_length=50, description="Phone number")
    company_name: str | None = Field(default=None, max_length=255, description="Company / Organisation name")
    title: str | None = Field(default=None, max_length=100, description="Job title")
    status: str = Field(default="new", max_length=50, description="Lead status")
    source: str | None = Field(default=None, max_length=100, description="Lead source")
    notes: str | None = Field(default=None, max_length=1000, description="Lead notes")
    owner_id: UUID | None = Field(default=None, description="Assigned owner user ID")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        cleaned = v.strip().lower()
        if "@" not in cleaned or "." not in cleaned.split("@")[-1]:
            raise ValueError("Invalid email format")
        return cleaned


class LeadCreate(LeadBase):
    """Shape for creating a new lead."""

    pass


class LeadUpdate(BaseModel):
    """Shape for updating an existing lead."""

    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    company_name: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, max_length=50)
    source: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=1000)
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


class LeadRead(LeadBase):
    """Shape returned when reading a lead record."""

    id: UUID
    tenant_id: UUID
    is_converted: bool = False
    converted_at: datetime | None = None
    converted_contact_id: UUID | None = None
    converted_account_id: UUID | None = None
    converted_opportunity_id: UUID | None = None
    converted_contact_name: str | None = None
    converted_account_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConvertLeadInput(BaseModel):
    """Payload options for converting a lead."""

    create_account: bool = Field(default=True, description="Whether to create an Account if no account_id is supplied")
    account_id: UUID | None = Field(default=None, description="Existing Account ID to link the contact to")
    account_name: str | None = Field(default=None, max_length=255, description="Name for newly created Account")
    opportunity_name: str | None = Field(default=None, max_length=255, description="Name for optional Opportunity shell")


class ConvertLeadResponse(BaseModel):
    """Response payload returned upon lead conversion."""

    lead: LeadRead
    contact_id: UUID
    account_id: UUID | None = None
    opportunity_id: UUID | None = None
