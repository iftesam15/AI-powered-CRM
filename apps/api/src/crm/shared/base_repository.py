"""Generic tenant-scoped base repository."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.shared.base_model import TenantModel


class BaseTenantRepository[ModelT: TenantModel]:
    """Base repository ensuring every query is constrained by tenant_id."""

    def __init__(self, model_cls: type[ModelT], session: AsyncSession) -> None:
        self.model_cls = model_cls
        self.session = session

    async def get_by_id(self, tenant_id: UUID, record_id: UUID) -> ModelT | None:
        """Fetch a single record by ID, scoped to the tenant."""
        stmt = select(self.model_cls).where(
            self.model_cls.id == record_id,
            self.model_cls.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_tenant(
        self,
        tenant_id: UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> list[ModelT]:
        """Fetch records belonging to the tenant."""
        stmt = (
            select(self.model_cls)
            .where(self.model_cls.tenant_id == tenant_id)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, record: ModelT) -> ModelT:
        """Add and flush a new record."""
        self.session.add(record)
        await self.session.flush()
        return record

    async def update(self, record: ModelT) -> ModelT:
        """Flush an updated record."""
        await self.session.flush()
        return record

    async def delete(self, tenant_id: UUID, record_id: UUID) -> bool:
        """Delete a record by ID scoped to tenant."""
        stmt = delete(self.model_cls).where(
            self.model_cls.id == record_id,
            self.model_cls.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        rowcount = getattr(result, "rowcount", 0)
        return bool(rowcount and rowcount > 0)
