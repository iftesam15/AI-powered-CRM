"""Task database model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.shared.base_model import TenantModel


class Task(TenantModel):
    """Task record representing an action item with due date and priority."""

    __tablename__ = "tasks"
    __table_args__ = (
        Index("ix_tasks_tenant_id_status", "tenant_id", "status"),
        Index("ix_tasks_tenant_id_due_date", "tenant_id", "due_date"),
        Index("ix_tasks_tenant_id_entity_type_entity_id", "tenant_id", "entity_type", "entity_id"),
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    priority: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "account" or "contact"
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, nullable=True)

    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    assigned_to_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    account = relationship("Account", backref="tasks", lazy="selectin")
    contact = relationship("Contact", backref="tasks", lazy="selectin")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id], lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
