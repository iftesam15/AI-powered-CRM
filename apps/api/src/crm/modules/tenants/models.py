"""Tenant database model."""

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from crm.shared.base_model import BaseModel


class Tenant(BaseModel):
    """Tenant organization in the multi-tenant SaaS CRM."""

    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    default_currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    locale: Mapped[str] = mapped_column(String(20), default="en-US", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
