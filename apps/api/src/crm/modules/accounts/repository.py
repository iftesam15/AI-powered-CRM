"""Account database queries.

All methods are tenant-scoped via BaseTenantRepository so an account ID
belonging to another organisation is never resolved or leaked.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from crm.modules.accounts.models import Account
from crm.shared.base_repository import BaseTenantRepository

SORTABLE_FIELDS: dict[str, InstrumentedAttribute[Any]] = {
    "name": Account.name,
    "industry": Account.industry,
    "size": Account.size,
    "created_at": Account.created_at,
    "updated_at": Account.updated_at,
}
DEFAULT_SORT = "name"


class AccountRepository(BaseTenantRepository[Account]):
    """Queries for account models."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Account, session)

    def _build_filter_conditions(
        self,
        tenant_id: UUID,
        search: str | None = None,
        industry: str | None = None,
        owner_id: UUID | None = None,
    ) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = [Account.tenant_id == tenant_id]

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Account.name.ilike(term),
                    Account.industry.ilike(term),
                    Account.website.ilike(term),
                    Account.address.ilike(term),
                )
            )

        if industry and industry.strip():
            conditions.append(Account.industry.ilike(industry.strip()))

        if owner_id:
            conditions.append(Account.owner_id == owner_id)

        return conditions

    async def list_accounts(
        self,
        tenant_id: UUID,
        search: str | None = None,
        industry: str | None = None,
        owner_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> list[Account]:
        """List accounts for a tenant with optional filtering and sorting."""
        conditions = self._build_filter_conditions(
            tenant_id, search=search, industry=industry, owner_id=owner_id
        )

        col = SORTABLE_FIELDS.get(sort_by, Account.name)
        order_clause = col.desc() if sort_dir.lower() == "desc" else col.asc()

        stmt = (
            select(Account)
            .where(*conditions)
            .order_by(order_clause, Account.id.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_accounts(
        self,
        tenant_id: UUID,
        search: str | None = None,
        industry: str | None = None,
        owner_id: UUID | None = None,
    ) -> int:
        """Count total accounts matching the filter conditions."""
        conditions = self._build_filter_conditions(
            tenant_id, search=search, industry=industry, owner_id=owner_id
        )
        stmt = select(func.count()).select_from(Account).where(*conditions)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def get_by_name(self, tenant_id: UUID, name: str) -> Account | None:
        """Find an account by name within a tenant (case-insensitive)."""
        stmt = select(Account).where(
            Account.tenant_id == tenant_id,
            Account.name.ilike(name.strip()),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
