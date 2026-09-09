"""Cross-entity search service.

Runs ILIKE queries against the primary columns of each business entity,
collects the results into a unified list scored by match quality, and
returns them as :class:`SearchResponse`.

The search is always tenant-scoped.  Swapping the underlying queries for
``tsvector`` or ``pg_trgm`` in the future requires changes only here.
"""

from uuid import UUID

from sqlalchemy import or_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from crm.modules.accounts.models import Account
from crm.modules.contacts.models import Contact
from crm.modules.leads.models import Lead
from crm.modules.opportunities.models import Opportunity
from crm.modules.search.schemas import SearchResponse, SearchResult

#: Entities the search service can query.
ALLOWED_TYPES = frozenset({"account", "contact", "lead", "opportunity"})

MAX_PER_TYPE = 10
MAX_TOTAL = 25


class SearchService:
    """Orchestrates a global, cross-entity search."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def search(
        self,
        tenant_id: UUID,
        query: str,
        entity_types: list[str] | None = None,
        limit: int = MAX_TOTAL,
    ) -> SearchResponse:
        q = query.strip()
        if not q:
            return SearchResponse(items=[], total=0, query=q)

        term = f"%{q}%"
        limit = min(limit, MAX_TOTAL)
        types = (
            set(entity_types) & ALLOWED_TYPES if entity_types else ALLOWED_TYPES
        )

        results: list[SearchResult] = []

        if "account" in types:
            results.extend(await self._search_accounts(tenant_id, term))
        if "contact" in types:
            results.extend(await self._search_contacts(tenant_id, term))
        if "lead" in types:
            results.extend(await self._search_leads(tenant_id, term))
        if "opportunity" in types:
            results.extend(await self._search_opportunities(tenant_id, term))

        results = results[:limit]
        return SearchResponse(items=results, total=len(results), query=q)

    # ------------------------------------------------------------------
    # Per-entity ILIKE queries
    # ------------------------------------------------------------------

    async def _search_accounts(
        self, tenant_id: UUID, term: str
    ) -> list[SearchResult]:
        stmt = (
            select(Account)
            .where(
                Account.tenant_id == tenant_id,
                or_(
                    Account.name.ilike(term),
                    Account.industry.ilike(term),
                    Account.website.ilike(term),
                ),
            )
            .order_by(Account.name.asc())
            .limit(MAX_PER_TYPE)
        )
        rows = await self.session.execute(stmt)
        return [
            SearchResult(
                entity_type="account",
                id=row.id,
                title=row.name,
                subtitle=row.industry,
                url=f"/accounts/{row.id}",
            )
            for row in rows.scalars().all()
        ]

    async def _search_contacts(
        self, tenant_id: UUID, term: str
    ) -> list[SearchResult]:
        stmt = (
            select(Contact)
            .where(
                Contact.tenant_id == tenant_id,
                or_(
                    Contact.first_name.ilike(term),
                    Contact.last_name.ilike(term),
                    Contact.email.ilike(term),
                    Contact.phone.ilike(term),
                    Contact.title.ilike(term),
                ),
            )
            .order_by(Contact.last_name.asc())
            .limit(MAX_PER_TYPE)
        )
        rows = await self.session.execute(stmt)
        return [
            SearchResult(
                entity_type="contact",
                id=row.id,
                title=f"{row.first_name} {row.last_name}",
                subtitle=row.email,
                url=f"/contacts/{row.id}",
            )
            for row in rows.scalars().all()
        ]

    async def _search_leads(
        self, tenant_id: UUID, term: str
    ) -> list[SearchResult]:
        stmt = (
            select(Lead)
            .where(
                Lead.tenant_id == tenant_id,
                or_(
                    Lead.first_name.ilike(term),
                    Lead.last_name.ilike(term),
                    Lead.email.ilike(term),
                    Lead.company_name.ilike(term),
                ),
            )
            .order_by(Lead.last_name.asc())
            .limit(MAX_PER_TYPE)
        )
        rows = await self.session.execute(stmt)
        return [
            SearchResult(
                entity_type="lead",
                id=row.id,
                title=f"{row.first_name} {row.last_name}",
                subtitle=row.company_name or row.email,
                url=f"/leads/{row.id}",
            )
            for row in rows.scalars().all()
        ]

    async def _search_opportunities(
        self, tenant_id: UUID, term: str
    ) -> list[SearchResult]:
        stmt = (
            select(Opportunity)
            .where(
                Opportunity.tenant_id == tenant_id,
                or_(
                    Opportunity.name.ilike(term),
                    Opportunity.notes.ilike(term),
                ),
            )
            .order_by(Opportunity.name.asc())
            .limit(MAX_PER_TYPE)
        )
        rows = await self.session.execute(stmt)
        return [
            SearchResult(
                entity_type="opportunity",
                id=row.id,
                title=row.name,
                subtitle=f"${row.amount:,.2f}" if row.amount else None,
                url=f"/opportunities/{row.id}",
            )
            for row in rows.scalars().all()
        ]
