"""Contact database model."""

import uuid

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from crm.shared.base_model import TenantModel


class Contact(TenantModel):
    """Contact representing an individual person associated with a tenant/account."""

    __tablename__ = "contacts"
    __table_args__ = (
        Index("ix_contacts_tenant_id_email", "tenant_id", "email"),
        Index("ix_contacts_tenant_id_account_id", "tenant_id", "account_id"),
        Index("ix_contacts_tenant_id_last_name", "tenant_id", "last_name"),
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str | None] = mapped_column(String(100), nullable=True)

    account_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Relationships
    account = relationship("Account", backref="contacts", lazy="joined")
