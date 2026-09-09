"""Pipeline and PipelineStage Pydantic validation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PipelineStageBase(BaseModel):
    name: str = Field(min_length=1, max_length=100, description="Stage name")
    display_order: int = Field(ge=0, description="Visual sort order")
    probability: int = Field(default=0, ge=0, le=100, description="Win probability percentage (0-100)")
    is_won: bool = Field(default=False, description="Whether this stage represents Closed Won")
    is_lost: bool = Field(default=False, description="Whether this stage represents Closed Lost")


class PipelineStageCreate(PipelineStageBase):
    """Schema for creating a pipeline stage."""

    pass


class PipelineStageUpdate(BaseModel):
    """Schema for updating a pipeline stage."""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    display_order: int | None = Field(default=None, ge=0)
    probability: int | None = Field(default=None, ge=0, le=100)
    is_won: bool | None = None
    is_lost: bool | None = None


class PipelineStageResponse(PipelineStageBase):
    """Schema returned for a pipeline stage."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    pipeline_id: UUID
    created_at: datetime
    updated_at: datetime


class PipelineStageReorderItem(BaseModel):
    id: UUID
    display_order: int = Field(ge=0)


class PipelineStageReorderRequest(BaseModel):
    stages: list[PipelineStageReorderItem]


class PipelineBase(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Pipeline name")
    is_default: bool = Field(default=True, description="Whether this is the default pipeline")


class PipelineCreate(PipelineBase):
    """Schema for creating a pipeline."""

    stages: list[PipelineStageCreate] | None = None


class PipelineUpdate(BaseModel):
    """Schema for updating a pipeline."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    is_default: bool | None = None


class PipelineResponse(PipelineBase):
    """Schema returned for a pipeline with its stages."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    stages: list[PipelineStageResponse] = []
    created_at: datetime
    updated_at: datetime
