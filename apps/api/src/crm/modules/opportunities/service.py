"""Opportunity business logic and stage transitions."""

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import NotFoundError, PermissionDeniedError, ValidationError
from crm.core.pagination import Page, PageParams
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext, diff
from crm.modules.opportunities.models import Opportunity, OpportunityStageHistory
from crm.modules.opportunities.repository import (
    DEFAULT_SORT,
    OpportunityRepository,
)
from crm.modules.opportunities.schemas import (
    CloseLostInput,
    CloseWonInput,
    OpportunityCreate,
    OpportunityRead,
    OpportunityStageHistoryRead,
    OpportunityUpdate,
    PipelineSummaryResponse,
    PipelineSummaryStage,
    StageMoveInput,
)
from crm.modules.pipelines.models import PipelineStage
from crm.modules.pipelines.repository import PipelineRepository
from crm.modules.pipelines.service import PipelineService
from crm.modules.users.models import User


class OpportunityService:
    """Orchestration for Opportunities and Pipeline operations."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = OpportunityRepository(session)
        self.pipeline_repo = PipelineRepository(session)
        self.pipeline_service = PipelineService(session)
        self.audit = AuditService(session)

    def _to_read_dto(self, opp: Opportunity) -> OpportunityRead:
        """Map Opportunity model to OpportunityRead schema with calculated fields."""
        weighted = (opp.amount * Decimal(opp.probability)) / Decimal(100)

        history_dtos = []
        for h in getattr(opp, "stage_history", []) or []:
            from_name = h.from_stage.name if h.from_stage else None
            to_name = h.to_stage.name if h.to_stage else None
            user_name = h.changed_by.full_name if h.changed_by else None
            history_dtos.append(
                OpportunityStageHistoryRead(
                    id=h.id,
                    opportunity_id=h.opportunity_id,
                    from_stage_id=h.from_stage_id,
                    from_stage_name=from_name,
                    to_stage_id=h.to_stage_id,
                    to_stage_name=to_name,
                    changed_by_id=h.changed_by_id,
                    changed_by_name=user_name,
                    days_in_stage=h.days_in_stage,
                    created_at=h.created_at,
                )
            )

        account_name = opp.account.name if opp.account else None
        contact_name = (
            f"{opp.primary_contact.first_name} {opp.primary_contact.last_name}"
            if opp.primary_contact
            else None
        )
        owner_name = opp.owner.full_name if opp.owner else None
        pipeline_name = opp.pipeline.name if opp.pipeline else None
        stage_name = opp.stage.name if opp.stage else None

        return OpportunityRead(
            id=opp.id,
            tenant_id=opp.tenant_id,
            name=opp.name,
            amount=opp.amount,
            currency=opp.currency,
            pipeline_id=opp.pipeline_id,
            pipeline_name=pipeline_name,
            stage_id=opp.stage_id,
            stage_name=stage_name,
            account_id=opp.account_id,
            account_name=account_name,
            primary_contact_id=opp.primary_contact_id,
            primary_contact_name=contact_name,
            owner_id=opp.owner_id,
            owner_name=owner_name,
            lead_id=opp.lead_id,
            expected_close_date=opp.expected_close_date,
            probability=opp.probability,
            weighted_amount=weighted.quantize(Decimal("0.01")),
            status=opp.status,
            loss_reason=opp.loss_reason,
            won_at=opp.won_at,
            lost_at=opp.lost_at,
            notes=opp.notes,
            stage_history=history_dtos,
            created_at=opp.created_at,
            updated_at=opp.updated_at,
        )

    async def list_opportunities(
        self,
        tenant_id: UUID,
        params: PageParams,
        search: str | None = None,
        pipeline_id: UUID | None = None,
        stage_id: UUID | None = None,
        status: str | None = None,
        owner_id: UUID | None = None,
        account_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "desc",
    ) -> Page[OpportunityRead]:
        items = await self.repo.list_opportunities(
            tenant_id=tenant_id,
            search=search,
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            status=status,
            owner_id=owner_id,
            account_id=account_id,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=params.limit,
            offset=params.offset,
        )
        total = await self.repo.count_opportunities(
            tenant_id=tenant_id,
            search=search,
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            status=status,
            owner_id=owner_id,
            account_id=account_id,
        )
        return Page.of(
            items=[self._to_read_dto(item) for item in items],
            total=total,
            params=params,
        )

    async def get_opportunity(self, tenant_id: UUID, opp_id: UUID) -> OpportunityRead:
        opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
        if not opp or opp.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this opportunity.")
        return self._to_read_dto(opp)

    async def create_opportunity(
        self,
        actor: User,
        dto: OpportunityCreate,
        context: RequestContext | None = None,
    ) -> OpportunityRead:
        tenant_id = actor.tenant_id

        # Resolve pipeline
        pipeline_id = dto.pipeline_id
        if not pipeline_id:
            default_pipeline = await self.pipeline_service.get_default_pipeline(tenant_id)
            pipeline_id = default_pipeline.id

        pipeline = await self.pipeline_repo.get_pipeline_with_stages(tenant_id, pipeline_id)
        if not pipeline or pipeline.tenant_id != tenant_id:
            raise NotFoundError("Pipeline not found")

        stages = pipeline.stages or []
        if not stages:
            raise NotFoundError("Pipeline has no stages configured")

        # Resolve stage
        stage_id = dto.stage_id
        selected_stage = None
        if stage_id:
            selected_stage = next((s for s in stages if s.id == stage_id), None)
            if not selected_stage:
                raise ValidationError("Specified stage does not belong to the selected pipeline.")
        else:
            selected_stage = stages[0]
            stage_id = selected_stage.id

        probability = dto.probability if dto.probability is not None else selected_stage.probability
        status_val = "open"
        won_at = None
        lost_at = None
        loss_reason = None

        if selected_stage.is_won:
            status_val = "won"
            won_at = datetime.now(timezone.utc)
            probability = 100
        elif selected_stage.is_lost:
            # If created directly in lost stage, loss reason must be present
            # or we reject with 422
            raise ValidationError("New opportunities cannot be created directly into Closed Lost stage without moving.")

        opp = Opportunity(
            tenant_id=tenant_id,
            name=dto.name.strip(),
            amount=dto.amount,
            currency=dto.currency.upper(),
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            account_id=dto.account_id,
            primary_contact_id=dto.primary_contact_id,
            owner_id=dto.owner_id or actor.id,
            lead_id=dto.lead_id,
            expected_close_date=dto.expected_close_date,
            probability=probability,
            status=status_val,
            loss_reason=loss_reason,
            won_at=won_at,
            lost_at=lost_at,
            notes=dto.notes,
        )
        created = await self.repo.create(opp)

        # Log initial stage entry in history
        history = OpportunityStageHistory(
            tenant_id=tenant_id,
            opportunity_id=created.id,
            from_stage_id=None,
            to_stage_id=stage_id,
            changed_by_id=actor.id,
            days_in_stage=0,
        )
        await self.repo.create_stage_history(history)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.OPPORTUNITY,
            entity_id=created.id,
            action=AuditAction.OPPORTUNITY_CREATED,
            summary=f"Created opportunity '{created.name}'",
            changes=diff({}, {"name": created.name, "amount": str(created.amount), "stage": selected_stage.name}),
            context=context,
        )

        reloaded = await self.repo.get_by_id_with_relations(tenant_id, created.id)
        return self._to_read_dto(reloaded or created)

    async def update_opportunity(
        self,
        actor: User,
        opp_id: UUID,
        dto: OpportunityUpdate,
        context: RequestContext | None = None,
    ) -> OpportunityRead:
        tenant_id = actor.tenant_id
        opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
        if not opp or opp.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this opportunity.")

        old_data = {
            "name": opp.name,
            "amount": str(opp.amount),
            "stage_id": str(opp.stage_id),
            "status": opp.status,
            "probability": opp.probability,
        }

        # If stage change is included in update, delegate to move_stage logic
        if dto.stage_id is not None and dto.stage_id != opp.stage_id:
            await self.move_stage(
                actor=actor,
                opp_id=opp_id,
                dto=StageMoveInput(stage_id=dto.stage_id, loss_reason=dto.loss_reason),
                context=context,
            )
            # reload opp
            opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
            if not opp:
                raise NotFoundError("Opportunity not found")

        if dto.name is not None:
            opp.name = dto.name.strip()
        if dto.amount is not None:
            opp.amount = dto.amount
        if dto.currency is not None:
            opp.currency = dto.currency.upper()
        if dto.account_id is not None:
            opp.account_id = dto.account_id
        if dto.primary_contact_id is not None:
            opp.primary_contact_id = dto.primary_contact_id
        if dto.owner_id is not None:
            opp.owner_id = dto.owner_id
        if dto.expected_close_date is not None:
            opp.expected_close_date = dto.expected_close_date
        if dto.probability is not None:
            opp.probability = dto.probability
        if dto.notes is not None:
            opp.notes = dto.notes

        await self.repo.update(opp)

        new_data = {
            "name": opp.name,
            "amount": str(opp.amount),
            "stage_id": str(opp.stage_id),
            "status": opp.status,
            "probability": opp.probability,
        }

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.OPPORTUNITY,
            entity_id=opp.id,
            action=AuditAction.OPPORTUNITY_UPDATED,
            summary=f"Updated opportunity '{opp.name}'",
            changes=diff(old_data, new_data),
            context=context,
        )

        reloaded = await self.repo.get_by_id_with_relations(tenant_id, opp.id)
        return self._to_read_dto(reloaded or opp)

    async def move_stage(
        self,
        actor: User,
        opp_id: UUID,
        dto: StageMoveInput,
        context: RequestContext | None = None,
    ) -> OpportunityRead:
        """Move an opportunity to another stage, recording stage transition history and audit."""
        tenant_id = actor.tenant_id
        opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
        if not opp or opp.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this opportunity.")

        old_stage_id = opp.stage_id
        if old_stage_id == dto.stage_id:
            return self._to_read_dto(opp)

        # Verify target stage exists in pipeline
        target_stage = await self.pipeline_repo.get_stage(tenant_id, dto.stage_id)
        if not target_stage or target_stage.pipeline_id != opp.pipeline_id:
            raise ValidationError("Target stage does not exist in this pipeline.")

        # Enforcement: Moving to Closed Lost REQUIRES loss_reason
        if target_stage.is_lost:
            if not dto.loss_reason or not dto.loss_reason.strip():
                raise ValidationError("Loss reason is required when moving to Closed Lost.")

        # Compute days in previous stage
        now_utc = datetime.now(timezone.utc)
        prev_time = opp.created_at
        if opp.stage_history:
            prev_time = opp.stage_history[-1].created_at
        if prev_time and prev_time.tzinfo is None:
            prev_time = prev_time.replace(tzinfo=timezone.utc)
        days_in_stage = max(0, (now_utc - prev_time).days) if prev_time else 0

        old_stage_name = opp.stage.name if opp.stage else "Previous Stage"
        audit_action = AuditAction.OPPORTUNITY_STAGE_CHANGED
        summary = f"Moved opportunity '{opp.name}' from {old_stage_name} to {target_stage.name}"

        # State updates
        if target_stage.is_lost:
            opp.status = "lost"
            opp.lost_at = now_utc
            opp.won_at = None
            opp.probability = 0
            opp.loss_reason = dto.loss_reason.strip()
            audit_action = AuditAction.OPPORTUNITY_LOST
            summary = f"Closed Lost opportunity '{opp.name}': {opp.loss_reason}"
        elif target_stage.is_won:
            opp.status = "won"
            opp.won_at = now_utc
            opp.lost_at = None
            opp.probability = 100
            opp.loss_reason = None
            audit_action = AuditAction.OPPORTUNITY_WON
            summary = f"Closed Won opportunity '{opp.name}'"
        else:
            opp.status = "open"
            opp.won_at = None
            opp.lost_at = None
            opp.loss_reason = None
            opp.probability = target_stage.probability

        opp.stage_id = target_stage.id
        await self.repo.update(opp)

        # Create history record
        history = OpportunityStageHistory(
            tenant_id=tenant_id,
            opportunity_id=opp.id,
            from_stage_id=old_stage_id,
            to_stage_id=target_stage.id,
            changed_by_id=actor.id,
            days_in_stage=days_in_stage,
        )
        await self.repo.create_stage_history(history)
        self.session.expire(opp, ["stage_history"])

        # Record audit
        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.OPPORTUNITY,
            entity_id=opp.id,
            action=audit_action,
            summary=summary,
            changes=diff(
                {"stage": old_stage_name, "status": opp.status},
                {"stage": target_stage.name, "status": opp.status, "loss_reason": opp.loss_reason},
            ),
            context=context,
        )

        reloaded = await self.repo.get_by_id_with_relations(tenant_id, opp.id)
        return self._to_read_dto(reloaded or opp)

    async def close_won(
        self,
        actor: User,
        opp_id: UUID,
        dto: CloseWonInput,
        context: RequestContext | None = None,
    ) -> OpportunityRead:
        tenant_id = actor.tenant_id
        opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
        if not opp or opp.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this opportunity.")

        stages = await self.pipeline_repo.get_stages_for_pipeline(tenant_id, opp.pipeline_id)
        won_stage = next((s for s in stages if s.is_won), None)
        if not won_stage:
            raise ValidationError("Pipeline has no Closed Won stage configured.")

        if dto.notes:
            opp.notes = f"{opp.notes}\n[Won]: {dto.notes}" if opp.notes else f"[Won]: {dto.notes}"

        return await self.move_stage(
            actor=actor,
            opp_id=opp_id,
            dto=StageMoveInput(stage_id=won_stage.id),
            context=context,
        )

    async def close_lost(
        self,
        actor: User,
        opp_id: UUID,
        dto: CloseLostInput,
        context: RequestContext | None = None,
    ) -> OpportunityRead:
        tenant_id = actor.tenant_id
        opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
        if not opp or opp.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this opportunity.")

        stages = await self.pipeline_repo.get_stages_for_pipeline(tenant_id, opp.pipeline_id)
        lost_stage = next((s for s in stages if s.is_lost), None)
        if not lost_stage:
            raise ValidationError("Pipeline has no Closed Lost stage configured.")

        if dto.notes:
            opp.notes = f"{opp.notes}\n[Lost Notes]: {dto.notes}" if opp.notes else f"[Lost Notes]: {dto.notes}"

        return await self.move_stage(
            actor=actor,
            opp_id=opp_id,
            dto=StageMoveInput(stage_id=lost_stage.id, loss_reason=dto.loss_reason),
            context=context,
        )

    async def delete_opportunity(
        self,
        actor: User,
        opp_id: UUID,
        context: RequestContext | None = None,
    ) -> None:
        tenant_id = actor.tenant_id
        opp = await self.repo.get_by_id_with_relations(tenant_id, opp_id)
        if not opp or opp.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this opportunity.")

        opp_name = opp.name
        await self.repo.delete(tenant_id, opp_id)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            entity_type=AuditEntity.OPPORTUNITY,
            entity_id=opp_id,
            action=AuditAction.OPPORTUNITY_DELETED,
            summary=f"Deleted opportunity '{opp_name}'",
            changes=diff({"name": opp_name}, {}),
            context=context,
        )

    async def get_pipeline_summary(
        self,
        tenant_id: UUID,
        pipeline_id: UUID | None = None,
    ) -> PipelineSummaryResponse:
        """Calculate pipeline totals, weighted values, and stage breakdowns."""
        if not pipeline_id:
            default_p = await self.pipeline_service.get_default_pipeline(tenant_id)
            pipeline_id = default_p.id

        pipeline = await self.pipeline_repo.get_pipeline_with_stages(tenant_id, pipeline_id)
        if not pipeline:
            raise NotFoundError("Pipeline not found")

        stages = pipeline.stages or []
        opps = await self.repo.list_opportunities(
            tenant_id=tenant_id,
            pipeline_id=pipeline_id,
            limit=10000,
        )

        stage_summaries: list[PipelineSummaryStage] = []
        total_opps = len(opps)
        total_pipeline_value = Decimal("0.00")
        weighted_pipeline_value = Decimal("0.00")
        won_value = Decimal("0.00")
        lost_value = Decimal("0.00")

        # Group by stage
        for stage in stages:
            stage_opps = [o for o in opps if o.stage_id == stage.id]
            stg_total = sum((o.amount for o in stage_opps), Decimal("0.00"))
            stg_weighted = sum(((o.amount * Decimal(o.probability)) / Decimal(100) for o in stage_opps), Decimal("0.00"))

            stage_summaries.append(
                PipelineSummaryStage(
                    stage_id=stage.id,
                    stage_name=stage.name,
                    display_order=stage.display_order,
                    probability=stage.probability,
                    is_won=stage.is_won,
                    is_lost=stage.is_lost,
                    count=len(stage_opps),
                    total_amount=stg_total.quantize(Decimal("0.01")),
                    weighted_amount=stg_weighted.quantize(Decimal("0.01")),
                )
            )

            if stage.is_won:
                won_value += stg_total
            elif stage.is_lost:
                lost_value += stg_total
            else:
                total_pipeline_value += stg_total
                weighted_pipeline_value += stg_weighted

        return PipelineSummaryResponse(
            total_opportunities=total_opps,
            total_pipeline_value=total_pipeline_value.quantize(Decimal("0.01")),
            weighted_pipeline_value=weighted_pipeline_value.quantize(Decimal("0.01")),
            won_value=won_value.quantize(Decimal("0.01")),
            lost_value=lost_value.quantize(Decimal("0.01")),
            stages=stage_summaries,
        )
