"""Lead database model."""

from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.shared.base_model import TenantModel


class Lead(TenantModel):
    """Lead representing a prospective customer before qualification and conversion."""

    __tablename__ = "leads"
    __table_args__ = (
        Index("ix_leads_tenant_id_status", "tenant_id", "status"),
        Index("ix_leads_tenant_id_email", "tenant_id", "email"),
        Index("ix_leads_tenant_id_last_name", "tenant_id", "last_name"),
        Index("ix_leads_tenant_id_is_converted", "tenant_id", "is_converted"),
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="new", index=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    is_converted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    converted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    converted_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    converted_account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    converted_opportunity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    converted_contact = relationship("Contact", foreign_keys=[converted_contact_id], lazy="joined")
    converted_account = relationship("Account", foreign_keys=[converted_account_id], lazy="joined")
