"""Activity database model."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.shared.base_model import TenantModel


class Activity(TenantModel):
    """Activity record representing an interaction (call, meeting, email, note)."""

    __tablename__ = "activities"
    __table_args__ = (
        Index("ix_activities_tenant_id_entity_type_entity_id", "tenant_id", "entity_type", "entity_id"),
        Index("ix_activities_tenant_id_performed_at", "tenant_id", "performed_at"),
    )

    activity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    performed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # "account" or "contact"
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)

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
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    account = relationship("Account", backref="activities", lazy="selectin")
    contact = relationship("Contact", backref="activities", lazy="selectin")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="selectin")
