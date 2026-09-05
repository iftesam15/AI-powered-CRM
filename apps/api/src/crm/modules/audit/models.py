"""Audit log model. Append-only: rows are inserted and never updated."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from crm.shared.base_model import TenantModel

#: JSONB on Postgres for indexable containment queries later; plain JSON on
#: SQLite so the integration tests can run without a database server.
JsonColumn = JSON().with_variant(JSONB(), "postgresql")


class AuditLog(TenantModel):
    """One recorded action: who did what, to which record, and what changed.

    `actor_email` is a snapshot rather than a join. An audit trail has to stay
    readable after the user row it points at is renamed or deleted, so the
    actor's identity is frozen at write time and `actor_user_id` is only a
    convenience link that may dangle.
    """

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_tenant_created", "tenant_id", "created_at"),
        Index("ix_audit_logs_tenant_action", "tenant_id", "action"),
        Index("ix_audit_logs_entity", "tenant_id", "entity_type", "entity_id"),
    )

    # Stamped in Python rather than by the database. `func.now()` is
    # second-granular on SQLite and transaction-start on Postgres, so entries
    # written moments apart share a timestamp and their order collapses to a
    # random UUID tie-break. An append-only log has to read back in the order it
    # was written, so the precision has to come from the application clock.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )

    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)
    summary: Mapped[str] = mapped_column(String(500), nullable=False, default="")

    #: `{"field": {"before": ..., "after": ...}}`. Empty for actions that do
    #: not mutate a record, such as a login.
    changes: Mapped[dict[str, Any] | None] = mapped_column(JsonColumn, nullable=True)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
