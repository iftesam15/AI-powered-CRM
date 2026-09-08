"""Schemas for activities domain module."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class ActivityType(StrEnum):
    CALL = "call"
    MEETING = "meeting"
    EMAIL = "email"
    NOTE = "note"


class EntityType(StrEnum):
    ACCOUNT = "account"
    CONTACT = "contact"


class ActivityCreate(BaseModel):
    activity_type: ActivityType
    title: Annotated[str, Field(min_length=1, max_length=255, strip_whitespace=True)]
    description: str | None = None
    performed_at: datetime | None = None
    entity_type: EntityType
    entity_id: uuid.UUID
    account_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    activity_type: ActivityType
    title: str
    description: str | None
    performed_at: datetime
    entity_type: EntityType
    entity_id: uuid.UUID
    account_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    account_name: str | None = None
    contact_name: str | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime


class TimelineItemRead(BaseModel):
    id: uuid.UUID
    item_type: str  # "activity" or "task"
    category: str  # call, meeting, email, note, task_created, task_completed, task_due
    title: str
    description: str | None
    timestamp: datetime
    status: str | None = None
    priority: str | None = None
    due_date: datetime | None = None
    entity_type: str | None
    entity_id: uuid.UUID | None
    actor_name: str | None = None
    raw_id: uuid.UUID
