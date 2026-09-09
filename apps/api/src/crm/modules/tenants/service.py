"""Tenant business service."""

import re
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import ConflictError, NotFoundError
from crm.modules.tenants.models import Tenant
from crm.modules.tenants.repository import TenantRepository
from crm.modules.tenants.schemas import TenantCreate


def slugify(text: str) -> str:
    """Generate a clean slug from a string."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text.strip("-")


class TenantService:
    """Orchestration for tenant management and provisioning."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TenantRepository(session)

    async def get_tenant(self, tenant_id: UUID) -> Tenant:
        tenant = await self.repo.get_by_id(tenant_id)
        if not tenant:
            raise NotFoundError("Tenant not found.")
        return tenant

    async def create_tenant(self, data: TenantCreate) -> Tenant:
        slug = data.slug or slugify(data.name)
        if not slug:
            slug = "default-tenant"

        existing = await self.repo.get_by_slug(slug)
        if existing:
            raise ConflictError(f"A tenant with slug '{slug}' already exists.")

        tenant = Tenant(
            name=data.name,
            slug=slug,
            default_currency=data.default_currency,
            locale=data.locale,
            is_active=True,
        )
        created_tenant = await self.repo.create(tenant)

        # Provision default pipeline & stages for new tenant
        from crm.modules.pipelines.service import PipelineService

        pipeline_service = PipelineService(self.session)
        await pipeline_service.seed_default_pipeline(created_tenant.id)

        return created_tenant
