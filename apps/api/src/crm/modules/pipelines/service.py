"""Pipeline and Stage business logic."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext, diff
from crm.modules.pipelines.models import Pipeline, PipelineStage
from crm.modules.pipelines.repository import PipelineRepository
from crm.modules.pipelines.schemas import (
    PipelineCreate,
    PipelineResponse,
    PipelineStageCreate,
    PipelineStageReorderRequest,
    PipelineStageResponse,
    PipelineStageUpdate,
)
from crm.modules.users.models import User

DEFAULT_STAGES = [
    {"name": "Qualification", "display_order": 1, "probability": 10, "is_won": False, "is_lost": False},
    {"name": "Discovery", "display_order": 2, "probability": 30, "is_won": False, "is_lost": False},
    {"name": "Proposal", "display_order": 3, "probability": 60, "is_won": False, "is_lost": False},
    {"name": "Negotiation", "display_order": 4, "probability": 80, "is_won": False, "is_lost": False},
    {"name": "Closed Won", "display_order": 5, "probability": 100, "is_won": True, "is_lost": False},
    {"name": "Closed Lost", "display_order": 6, "probability": 0, "is_won": False, "is_lost": True},
]


class PipelineService:
    """Orchestration for pipelines and stages."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = PipelineRepository(session)
        self.audit = AuditService(session)

    async def seed_default_pipeline(self, tenant_id: UUID) -> Pipeline:
        """Seed a standard B2B sales pipeline for a tenant if none exists."""
        existing = await self.repo.get_default_pipeline(tenant_id)
        if existing:
            return existing

        pipeline = Pipeline(
            tenant_id=tenant_id,
            name="Standard Sales Pipeline",
            is_default=True,
        )
        self.session.add(pipeline)
        await self.session.flush()

        for stg_data in DEFAULT_STAGES:
            stage = PipelineStage(
                tenant_id=tenant_id,
                pipeline_id=pipeline.id,
                name=stg_data["name"],
                display_order=stg_data["display_order"],
                probability=stg_data["probability"],
                is_won=stg_data["is_won"],
                is_lost=stg_data["is_lost"],
            )
            self.session.add(stage)

        await self.session.flush()
        # Reload pipeline with stages
        reloaded = await self.repo.get_pipeline_with_stages(tenant_id, pipeline.id)
        return reloaded or pipeline

    async def get_default_pipeline(self, tenant_id: UUID) -> PipelineResponse:
        """Get default pipeline, seeding default stages if none exist."""
        pipeline = await self.repo.get_default_pipeline(tenant_id)
        if not pipeline or not pipeline.stages:
            pipeline = await self.seed_default_pipeline(tenant_id)
        return PipelineResponse.model_validate(pipeline)

    async def list_pipelines(self, tenant_id: UUID) -> list[PipelineResponse]:
        """List all pipelines for a tenant."""
        pipelines = await self.repo.list_pipelines(tenant_id)
        if not pipelines:
            default_p = await self.seed_default_pipeline(tenant_id)
            pipelines = [default_p]
        return [PipelineResponse.model_validate(p) for p in pipelines]

    async def get_pipeline(self, tenant_id: UUID, pipeline_id: UUID) -> PipelineResponse:
        """Retrieve a pipeline by ID with its stages."""
        pipeline = await self.repo.get_pipeline_with_stages(tenant_id, pipeline_id)
        if not pipeline or pipeline.tenant_id != tenant_id:
            raise NotFoundError("Pipeline not found")
        return PipelineResponse.model_validate(pipeline)

    async def create_stage(
        self,
        actor: User,
        pipeline_id: UUID,
        dto: PipelineStageCreate,
        context: RequestContext | None = None,
    ) -> PipelineStageResponse:
        """Add a stage to a pipeline."""
        tenant_id = actor.tenant_id
        pipeline = await self.repo.get_pipeline_with_stages(tenant_id, pipeline_id)
        if not pipeline or pipeline.tenant_id != tenant_id:
            raise NotFoundError("Pipeline not found")

        # Determine display order if not specified
        order = dto.display_order
        existing_stages = pipeline.stages or []
        if order is None or order <= 0:
            max_order = max([s.display_order for s in existing_stages], default=0)
            order = max_order + 1

        stage = PipelineStage(
            tenant_id=tenant_id,
            pipeline_id=pipeline_id,
            name=dto.name.strip(),
            display_order=order,
            probability=dto.probability,
            is_won=dto.is_won,
            is_lost=dto.is_lost,
        )
        created = await self.repo.create_stage(stage)
        reloaded_created = await self.repo.get_stage(tenant_id, created.id) or created

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.PIPELINE_STAGE,
            entity_id=created.id,
            action=AuditAction.STAGE_CREATED,
            summary=f"Created stage '{created.name}' in pipeline '{pipeline.name}'",
            changes=diff({}, {"name": created.name, "order": created.display_order, "prob": created.probability}),
            context=context,
        )
        return PipelineStageResponse.model_validate(reloaded_created)

    async def update_stage(
        self,
        actor: User,
        pipeline_id: UUID,
        stage_id: UUID,
        dto: PipelineStageUpdate,
        context: RequestContext | None = None,
    ) -> PipelineStageResponse:
        """Update a stage's attributes."""
        tenant_id = actor.tenant_id
        stage = await self.repo.get_stage(tenant_id, stage_id)
        if not stage or stage.pipeline_id != pipeline_id or stage.tenant_id != tenant_id:
            raise NotFoundError("Stage not found")

        old_data = {
            "name": stage.name,
            "display_order": stage.display_order,
            "probability": stage.probability,
            "is_won": stage.is_won,
            "is_lost": stage.is_lost,
        }

        if dto.name is not None:
            stage.name = dto.name.strip()
        if dto.display_order is not None:
            stage.display_order = dto.display_order
        if dto.probability is not None:
            stage.probability = dto.probability
        if dto.is_won is not None:
            stage.is_won = dto.is_won
        if dto.is_lost is not None:
            stage.is_lost = dto.is_lost

        await self.repo.update(stage)
        reloaded_stage = await self.repo.get_stage(tenant_id, stage_id) or stage

        new_data = {
            "name": stage.name,
            "display_order": stage.display_order,
            "probability": stage.probability,
            "is_won": stage.is_won,
            "is_lost": stage.is_lost,
        }

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.PIPELINE_STAGE,
            entity_id=stage.id,
            action=AuditAction.STAGE_UPDATED,
            summary=f"Updated stage '{stage.name}'",
            changes=diff(old_data, new_data),
            context=context,
        )
        return PipelineStageResponse.model_validate(reloaded_stage)

    async def delete_stage(
        self,
        actor: User,
        pipeline_id: UUID,
        stage_id: UUID,
        context: RequestContext | None = None,
    ) -> None:
        """Delete a stage from a pipeline, ensuring no opportunities are attached."""
        tenant_id = actor.tenant_id
        stage = await self.repo.get_stage(tenant_id, stage_id)
        if not stage or stage.pipeline_id != pipeline_id or stage.tenant_id != tenant_id:
            raise NotFoundError("Stage not found")

        # Import Opportunity lazily to avoid circular imports
        from crm.modules.opportunities.models import Opportunity

        opp_count_stmt = (
            select(func.count())
            .select_from(Opportunity)
            .where(
                Opportunity.tenant_id == tenant_id,
                Opportunity.stage_id == stage_id,
            )
        )
        res = await self.session.execute(opp_count_stmt)
        opp_count = res.scalar_one()
        if opp_count > 0:
            raise ConflictError(
                f"Cannot delete stage '{stage.name}' because {opp_count} opportunity(ies) are currently in this stage. Move them to another stage first."
            )

        stage_name = stage.name
        await self.repo.delete_stage(tenant_id, stage_id)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.PIPELINE_STAGE,
            entity_id=stage_id,
            action=AuditAction.STAGE_DELETED,
            summary=f"Deleted stage '{stage_name}'",
            changes=diff({"name": stage_name}, {}),
            context=context,
        )

    async def reorder_stages(
        self,
        actor: User,
        pipeline_id: UUID,
        req: PipelineStageReorderRequest,
        context: RequestContext | None = None,
    ) -> list[PipelineStageResponse]:
        """Reorder stages in a pipeline."""
        tenant_id = actor.tenant_id
        pipeline = await self.repo.get_pipeline_with_stages(tenant_id, pipeline_id)
        if not pipeline or pipeline.tenant_id != tenant_id:
            raise NotFoundError("Pipeline not found")

        stages_by_id = {s.id: s for s in pipeline.stages}
        for item in req.stages:
            if item.id in stages_by_id:
                stages_by_id[item.id].display_order = item.display_order

        await self.session.flush()

        stages = await self.repo.get_stages_for_pipeline(tenant_id, pipeline_id)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.PIPELINE,
            entity_id=pipeline_id,
            action=AuditAction.PIPELINE_UPDATED,
            summary=f"Reordered stages in pipeline '{pipeline.name}'",
            changes={},
            context=context,
        )
        return [PipelineStageResponse.model_validate(s) for s in stages]
