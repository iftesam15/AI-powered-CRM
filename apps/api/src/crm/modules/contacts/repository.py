"""Contact database queries.

All methods are tenant-scoped via BaseTenantRepository so a contact ID
belonging to another organisation is never resolved or leaked.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from crm.modules.contacts.models import Contact
from crm.shared.base_repository import BaseTenantRepository

SORTABLE_FIELDS: dict[str, InstrumentedAttribute[Any]] = {
    "first_name": Contact.first_name,
    "last_name": Contact.last_name,
    "email": Contact.email,
    "title": Contact.title,
    "created_at": Contact.created_at,
    "updated_at": Contact.updated_at,
}
DEFAULT_SORT = "last_name"


class ContactRepository(BaseTenantRepository[Contact]):
    """Queries for contact models."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Contact, session)

    def _build_filter_conditions(
        self,
        tenant_id: UUID,
        search: str | None = None,
        account_id: UUID | None = None,
        owner_id: UUID | None = None,
    ) -> list[ColumnElement[bool]]:
        conditions: list[ColumnElement[bool]] = [Contact.tenant_id == tenant_id]

        if search and search.strip():
            term = f"%{search.strip()}%"
            conditions.append(
                or_(
                    Contact.first_name.ilike(term),
                    Contact.last_name.ilike(term),
                    Contact.email.ilike(term),
                    Contact.phone.ilike(term),
                    Contact.title.ilike(term),
                )
            )

        if account_id:
            conditions.append(Contact.account_id == account_id)

        if owner_id:
            conditions.append(Contact.owner_id == owner_id)

        return conditions

    async def list_contacts(
        self,
        tenant_id: UUID,
        search: str | None = None,
        account_id: UUID | None = None,
        owner_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "asc",
        limit: int = 50,
        offset: int = 0,
    ) -> list[Contact]:
        """List contacts for a tenant with optional filtering and sorting."""
        conditions = self._build_filter_conditions(
            tenant_id, search=search, account_id=account_id, owner_id=owner_id
        )

        col = SORTABLE_FIELDS.get(sort_by, Contact.last_name)
        order_clause = col.desc() if sort_dir.lower() == "desc" else col.asc()

        stmt = (
            select(Contact)
            .where(*conditions)
            .order_by(order_clause, Contact.id.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_contacts(
        self,
        tenant_id: UUID,
        search: str | None = None,
        account_id: UUID | None = None,
        owner_id: UUID | None = None,
    ) -> int:
        """Count total contacts matching the filter conditions."""
        conditions = self._build_filter_conditions(
            tenant_id, search=search, account_id=account_id, owner_id=owner_id
        )
        stmt = select(func.count()).select_from(Contact).where(*conditions)
        result = await self.session.execute(stmt)
        return result.scalar() or 0

    async def find_by_email(self, tenant_id: UUID, email: str) -> list[Contact]:
        """Find contacts by email address within a tenant (case-insensitive)."""
        if not email or not email.strip():
            return []
        stmt = select(Contact).where(
            Contact.tenant_id == tenant_id,
            Contact.email.ilike(email.strip()),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_account_id(self, tenant_id: UUID, account_id: UUID) -> list[Contact]:
        """Get all contacts belonging to a specific account within a tenant."""
        stmt = (
            select(Contact)
            .where(
                Contact.tenant_id == tenant_id,
                Contact.account_id == account_id,
            )
            .order_by(Contact.last_name.asc(), Contact.first_name.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
