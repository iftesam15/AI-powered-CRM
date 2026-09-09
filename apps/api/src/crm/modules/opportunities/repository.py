"""Opportunity database repository."""

from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, joinedload, selectinload

from crm.modules.accounts.models import Account
from crm.modules.contacts.models import Contact
from crm.modules.opportunities.models import Opportunity, OpportunityStageHistory
from crm.modules.pipelines.models import Pipeline, PipelineStage
from crm.shared.base_repository import BaseTenantRepository

SORTABLE_FIELDS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Opportunity.name,
    "amount": Opportunity.amount,
    "expected_close_date": Opportunity.expected_close_date,
    "probability": Opportunity.probability,
    "status": Opportunity.status,
    "created_at": Opportunity.created_at,
    "updated_at": Opportunity.updated_at,
}
DEFAULT_SORT = "created_at"


class OpportunityRepository(BaseTenantRepository[Opportunity]):
    """Tenant-scoped database queries for Opportunity."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Opportunity, session)

    async def get_by_id_with_relations(self, tenant_id: UUID, opp_id: UUID) -> Opportunity | None:
        stmt = (
            select(Opportunity)
            .where(
                Opportunity.id == opp_id,
                Opportunity.tenant_id == tenant_id,
            )
            .options(
                joinedload(Opportunity.pipeline),
                joinedload(Opportunity.stage),
                joinedload(Opportunity.account),
                joinedload(Opportunity.primary_contact),
                joinedload(Opportunity.owner),
                selectinload(Opportunity.stage_history).joinedload(OpportunityStageHistory.from_stage),
                selectinload(Opportunity.stage_history).joinedload(OpportunityStageHistory.to_stage),
                selectinload(Opportunity.stage_history).joinedload(OpportunityStageHistory.changed_by),
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _build_filter_conditions(
        self,
        tenant_id: UUID,
        search: str | None = None,
        pipeline_id: UUID | None = None,
        stage_id: UUID | None = None,
        status: str | None = None,
        owner_id: UUID | None = None,
        account_id: UUID | None = None,
    ) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = [Opportunity.tenant_id == tenant_id]

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Opportunity.name.ilike(term),
                    Opportunity.notes.ilike(term),
                )
            )

        if pipeline_id:
            conditions.append(Opportunity.pipeline_id == pipeline_id)
        if stage_id:
            conditions.append(Opportunity.stage_id == stage_id)
        if status and status.strip():
            conditions.append(Opportunity.status == status.strip().lower())
        if owner_id:
            conditions.append(Opportunity.owner_id == owner_id)
        if account_id:
            conditions.append(Opportunity.account_id == account_id)

        return conditions

    async def list_opportunities(
        self,
        tenant_id: UUID,
        search: str | None = None,
        pipeline_id: UUID | None = None,
        stage_id: UUID | None = None,
        status: str | None = None,
        owner_id: UUID | None = None,
        account_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> list[Opportunity]:
        conditions = self._build_filter_conditions(
            tenant_id=tenant_id,
            search=search,
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            status=status,
            owner_id=owner_id,
            account_id=account_id,
        )

        sort_col = SORTABLE_FIELDS.get(sort_by, Opportunity.created_at)
        order_clause = sort_col.asc() if sort_dir.lower() == "asc" else sort_col.desc()

        stmt = (
            select(Opportunity)
            .where(*conditions)
            .options(
                joinedload(Opportunity.pipeline),
                joinedload(Opportunity.stage),
                joinedload(Opportunity.account),
                joinedload(Opportunity.primary_contact),
                joinedload(Opportunity.owner),
            )
            .order_by(order_clause)
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_opportunities(
        self,
        tenant_id: UUID,
        search: str | None = None,
        pipeline_id: UUID | None = None,
        stage_id: UUID | None = None,
        status: str | None = None,
        owner_id: UUID | None = None,
        account_id: UUID | None = None,
    ) -> int:
        conditions = self._build_filter_conditions(
            tenant_id=tenant_id,
            search=search,
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            status=status,
            owner_id=owner_id,
            account_id=account_id,
        )
        stmt = select(func.count()).select_from(Opportunity).where(*conditions)
        result = await self.session.execute(stmt)
        return result.scalar_one()

    async def create_stage_history(self, history: OpportunityStageHistory) -> OpportunityStageHistory:
        self.session.add(history)
        await self.session.flush()
        return history
