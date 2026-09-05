"""Shared model bases and mixins for multi-tenancy and audit timestamps."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from crm.core.database import Base


class BaseModel(Base):
    """Abstract base model with UUID primary key and timestamp tracking."""

    __abstract__ = True

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class TenantMixin:
    """Mixin for tenant-owned models enforcing tenant scoping."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )


class TenantModel(BaseModel, TenantMixin):
    """Abstract base model for all tenant-owned entities."""

    __abstract__ = True
