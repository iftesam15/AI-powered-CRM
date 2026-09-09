"""Opportunity and OpportunityStageHistory database models."""

from datetime import date, datetime
from decimal import Decimal
import uuid

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.shared.base_model import TenantModel


class Opportunity(TenantModel):
    """Deal / Opportunity tracked across pipeline stages."""

    __tablename__ = "opportunities"
    __table_args__ = (
        Index("ix_opportunities_tenant_id_status", "tenant_id", "status"),
        Index("ix_opportunities_tenant_id_stage_id", "tenant_id", "stage_id"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")

    pipeline_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("pipelines.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("pipeline_stages.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    primary_contact_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lead_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
    )

    expected_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    probability: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="open",
        index=True,
    )  # "open", "won", "lost"
    loss_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    won_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lost_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    # Relationships
    pipeline = relationship("Pipeline", lazy="joined")
    stage = relationship("PipelineStage", foreign_keys=[stage_id], lazy="joined")
    account = relationship("Account", lazy="joined")
    primary_contact = relationship("Contact", lazy="joined")
    owner = relationship("User", foreign_keys=[owner_id], lazy="joined")
    lead = relationship("Lead", lazy="joined")
    stage_history: Mapped[list["OpportunityStageHistory"]] = relationship(
        "OpportunityStageHistory",
        back_populates="opportunity",
        order_by="OpportunityStageHistory.created_at.asc()",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class OpportunityStageHistory(TenantModel):
    """Audit transition record for every stage move on an opportunity."""

    __tablename__ = "opportunity_stage_history"

    opportunity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("opportunities.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_stage_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("pipeline_stages.id", ondelete="SET NULL"),
        nullable=True,
    )
    to_stage_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("pipeline_stages.id", ondelete="RESTRICT"),
        nullable=False,
    )
    changed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    days_in_stage: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    opportunity: Mapped["Opportunity"] = relationship("Opportunity", back_populates="stage_history")
    from_stage = relationship("PipelineStage", foreign_keys=[from_stage_id], lazy="joined")
    to_stage = relationship("PipelineStage", foreign_keys=[to_stage_id], lazy="joined")
    changed_by = relationship("User", foreign_keys=[changed_by_id], lazy="joined")
