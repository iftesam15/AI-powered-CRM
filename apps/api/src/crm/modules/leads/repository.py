"""Lead database queries.

All methods are tenant-scoped via BaseTenantRepository so a lead ID
belonging to another organisation is never resolved or leaked.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from crm.modules.leads.models import Lead
from crm.shared.base_repository import BaseTenantRepository

SORTABLE_FIELDS: dict[str, InstrumentedAttribute[Any]] = {
    "first_name": Lead.first_name,
    "last_name": Lead.last_name,
    "email": Lead.email,
    "company_name": Lead.company_name,
    "status": Lead.status,
    "created_at": Lead.created_at,
    "updated_at": Lead.updated_at,
}
DEFAULT_SORT = "created_at"


class LeadRepository(BaseTenantRepository[Lead]):
    """Queries for lead models."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Lead, session)

    def _build_filter_conditions(
        self,
        tenant_id: UUID,
        search: str | None = None,
        status: str | None = None,
        is_converted: bool | None = None,
        owner_id: UUID | None = None,
    ) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = [Lead.tenant_id == tenant_id]

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Lead.first_name.ilike(term),
                    Lead.last_name.ilike(term),
                    Lead.email.ilike(term),
                    Lead.phone.ilike(term),
                    Lead.company_name.ilike(term),
                    Lead.title.ilike(term),
                )
            )

        if status and status.strip():
            conditions.append(Lead.status == status.strip())

        if is_converted is not None:
            conditions.append(Lead.is_converted == is_converted)

        if owner_id:
            conditions.append(Lead.owner_id == owner_id)

        return conditions

    async def list_leads(
        self,
        tenant_id: UUID,
        search: str | None = None,
        status: str | None = None,
        is_converted: bool | None = None,
        owner_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "desc",
        limit: int = 50,
        offset: int = 0,
    ) -> list[Lead]:
        """List leads for a tenant with optional filtering and sorting."""
        conditions = self._build_filter_conditions(
            tenant_id,
            search=search,
            status=status,
            is_converted=is_converted,
            owner_id=owner_id,
        )

        col = SORTABLE_FIELDS.get(sort_by, Lead.created_at)
        order_clause = col.desc() if sort_dir.lower() == "desc" else col.asc()

        stmt = (
            select(Lead)
            .where(*conditions)
            .order_by(order_clause, Lead.id.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_leads(
        self,
        tenant_id: UUID,
        search: str | None = None,
        status: str | None = None,
        is_converted: bool | None = None,
        owner_id: UUID | None = None,
    ) -> int:
        """Count total leads matching filter conditions."""
        conditions = self._build_filter_conditions(
            tenant_id,
            search=search,
            status=status,
            is_converted=is_converted,
            owner_id=owner_id,
        )
        stmt = select(func.count()).select_from(Lead).where(*conditions)
        result = await self.session.execute(stmt)
        return result.scalar() or 0
