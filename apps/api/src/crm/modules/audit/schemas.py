"""Audit log response schemas. There is no write schema on purpose.

Audit rows are produced by `AuditService.record(...)` from inside other
services. Nothing accepts an audit entry over HTTP, so the trail cannot be
forged by a caller.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user_id: UUID | None
    actor_email: str
    action: str
    entity_type: str
    entity_id: UUID | None
    summary: str
    changes: dict[str, Any] | None
    ip_address: str | None
    request_id: str | None
    created_at: datetime
