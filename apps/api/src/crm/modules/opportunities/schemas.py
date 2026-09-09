"""Opportunity Pydantic validation and serialization schemas."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OpportunityBase(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Opportunity name / Deal title")
    amount: Decimal = Field(default=Decimal("0.00"), ge=0, description="Deal monetary value")
    currency: str = Field(default="USD", min_length=3, max_length=3, description="ISO-4217 Currency code")
    pipeline_id: UUID | None = Field(default=None, description="Pipeline ID (defaults to default pipeline)")
    stage_id: UUID | None = Field(default=None, description="Stage ID (defaults to first stage)")
    account_id: UUID | None = Field(default=None, description="Associated Account ID")
    primary_contact_id: UUID | None = Field(default=None, description="Associated primary Contact ID")
    owner_id: UUID | None = Field(default=None, description="Assigned sales owner User ID")
    lead_id: UUID | None = Field(default=None, description="Source Lead ID if converted")
    expected_close_date: date | None = Field(default=None, description="Target close date")
    probability: int | None = Field(default=None, ge=0, le=100, description="Win probability override (0-100)")
    notes: str | None = Field(default=None, max_length=2000, description="Internal notes")


class OpportunityCreate(OpportunityBase):
    """Payload to create an opportunity."""

    pass


class OpportunityUpdate(BaseModel):
    """Payload to update opportunity fields."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    pipeline_id: UUID | None = None
    stage_id: UUID | None = None
    account_id: UUID | None = None
    primary_contact_id: UUID | None = None
    owner_id: UUID | None = None
    expected_close_date: date | None = None
    probability: int | None = Field(default=None, ge=0, le=100)
    notes: str | None = Field(default=None, max_length=2000)
    status: str | None = None
    loss_reason: str | None = Field(default=None, max_length=500)


class StageMoveInput(BaseModel):
    """Payload when dragging/moving an opportunity between stages."""

    stage_id: UUID
    loss_reason: str | None = Field(default=None, max_length=500)

    @field_validator("loss_reason")
    @classmethod
    def strip_whitespace(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            return v if v else None
        return None


class CloseWonInput(BaseModel):
    """Payload when marking opportunity as Won."""

    notes: str | None = Field(default=None, max_length=1000)


class CloseLostInput(BaseModel):
    """Payload when marking opportunity as Lost. loss_reason is strictly required."""

    loss_reason: str = Field(min_length=1, max_length=500, description="Reason why the deal was lost")
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("loss_reason")
    @classmethod
    def validate_loss_reason(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Loss reason is required when closing an opportunity as Lost.")
        return v.strip()


class OpportunityStageHistoryRead(BaseModel):
    """Record of an opportunity's stage transitions."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    opportunity_id: UUID
    from_stage_id: UUID | None = None
    from_stage_name: str | None = None
    to_stage_id: UUID
    to_stage_name: str | None = None
    changed_by_id: UUID | None = None
    changed_by_name: str | None = None
    days_in_stage: int | None = None
    created_at: datetime


class OpportunityRead(BaseModel):
    """Full opportunity details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    name: str
    amount: Decimal
    currency: str
    pipeline_id: UUID
    pipeline_name: str | None = None
    stage_id: UUID
    stage_name: str | None = None
    account_id: UUID | None = None
    account_name: str | None = None
    primary_contact_id: UUID | None = None
    primary_contact_name: str | None = None
    owner_id: UUID | None = None
    owner_name: str | None = None
    lead_id: UUID | None = None
    expected_close_date: date | None = None
    probability: int
    weighted_amount: Decimal = Decimal("0.00")
    status: str
    loss_reason: str | None = None
    won_at: datetime | None = None
    lost_at: datetime | None = None
    notes: str | None = None
    stage_history: list[OpportunityStageHistoryRead] = []
    created_at: datetime
    updated_at: datetime


class PipelineSummaryStage(BaseModel):
    stage_id: UUID
    stage_name: str
    display_order: int
    probability: int
    is_won: bool
    is_lost: bool
    count: int
    total_amount: Decimal
    weighted_amount: Decimal


class PipelineSummaryResponse(BaseModel):
    total_opportunities: int
    total_pipeline_value: Decimal
    weighted_pipeline_value: Decimal
    won_value: Decimal
    lost_value: Decimal
    stages: list[PipelineSummaryStage]
