"""Pipeline and PipelineStage database queries."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from crm.modules.pipelines.models import Pipeline, PipelineStage
from crm.shared.base_repository import BaseTenantRepository


class PipelineRepository(BaseTenantRepository[Pipeline]):
    """Tenant-scoped queries for Pipeline and PipelineStage."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Pipeline, session)

    async def get_default_pipeline(self, tenant_id: UUID) -> Pipeline | None:
        stmt = (
            select(Pipeline)
            .where(
                Pipeline.tenant_id == tenant_id,
                Pipeline.is_default.is_(True),
            )
            .options(selectinload(Pipeline.stages))
        )
        result = await self.session.execute(stmt)
        pipeline = result.scalar_one_or_none()
        if pipeline is None:
            # Fallback to any pipeline for tenant
            stmt_any = (
                select(Pipeline)
                .where(Pipeline.tenant_id == tenant_id)
                .order_by(Pipeline.created_at.asc())
                .options(selectinload(Pipeline.stages))
            )
            res_any = await self.session.execute(stmt_any)
            pipeline = res_any.scalar_one_or_none()
        return pipeline

    async def get_pipeline_with_stages(self, tenant_id: UUID, pipeline_id: UUID) -> Pipeline | None:
        stmt = (
            select(Pipeline)
            .where(
                Pipeline.id == pipeline_id,
                Pipeline.tenant_id == tenant_id,
            )
            .options(selectinload(Pipeline.stages))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_pipelines(self, tenant_id: UUID) -> list[Pipeline]:
        stmt = (
            select(Pipeline)
            .where(Pipeline.tenant_id == tenant_id)
            .options(selectinload(Pipeline.stages))
            .order_by(Pipeline.created_at.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_stage(self, tenant_id: UUID, stage_id: UUID) -> PipelineStage | None:
        stmt = select(PipelineStage).where(
            PipelineStage.id == stage_id,
            PipelineStage.tenant_id == tenant_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_stages_for_pipeline(self, tenant_id: UUID, pipeline_id: UUID) -> list[PipelineStage]:
        stmt = (
            select(PipelineStage)
            .where(
                PipelineStage.tenant_id == tenant_id,
                PipelineStage.pipeline_id == pipeline_id,
            )
            .order_by(PipelineStage.display_order.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create_stage(self, stage: PipelineStage) -> PipelineStage:
        self.session.add(stage)
        await self.session.flush()
        return stage

    async def delete_stage(self, tenant_id: UUID, stage_id: UUID) -> bool:
        stage = await self.get_stage(tenant_id, stage_id)
        if not stage:
            return False
        await self.session.delete(stage)
        await self.session.flush()
        return True
