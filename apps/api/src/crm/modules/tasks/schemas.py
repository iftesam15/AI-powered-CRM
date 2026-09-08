"""Schemas for tasks domain module."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field


class TaskStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TaskPriority(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class TaskCreate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=255, strip_whitespace=True)]
    description: str | None = None
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    due_date: datetime | None = None
    entity_type: str | None = None  # "account" or "contact"
    entity_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: Annotated[str, Field(min_length=1, max_length=255, strip_whitespace=True)] | None = None
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    due_date: datetime | None = None
    entity_type: str | None = None
    entity_id: uuid.UUID | None = None
    account_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    assigned_to_id: uuid.UUID | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    priority: TaskPriority
    due_date: datetime | None
    completed_at: datetime | None
    entity_type: str | None
    entity_id: uuid.UUID | None
    account_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    assigned_to_id: uuid.UUID | None
    created_by_id: uuid.UUID | None
    account_name: str | None = None
    contact_name: str | None = None
    assigned_to_name: str | None = None
    created_by_name: str | None = None
    created_at: datetime
    updated_at: datetime
