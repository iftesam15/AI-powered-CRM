"""Account database model."""

import uuid

from sqlalchemy import ForeignKey, Index, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from crm.shared.base_model import TenantModel


class Account(TenantModel):
    """Account representing a business organization/customer."""

    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_accounts_tenant_name"),
        Index("ix_accounts_tenant_id_name", "tenant_id", "name"),
        Index("ix_accounts_tenant_id_industry", "tenant_id", "industry"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
