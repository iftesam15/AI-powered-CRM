"""Global search HTTP router.

Any authenticated user may search — the results are already tenant-scoped
inside the service layer.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import require_permission
from crm.core.rbac import Permission
from crm.core.exceptions import ValidationError
from crm.modules.search.schemas import SearchResponse
from crm.modules.search.service import ALLOWED_TYPES, SearchService
from crm.modules.users.models import User
from crm.core.dependencies import CurrentTenant

router = APIRouter(prefix="/search", tags=["search"])

SearchAccess = Annotated[User, Depends(require_permission(Permission.SEARCH_READ))]


@router.get(
    "",
    response_model=SearchResponse,
    summary="Global search across all entities",
)
async def global_search(
    _: SearchAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str, Query(description="Search query.")] = "",
    types: Annotated[
        str | None,
        Query(
            description="Comma-separated entity types to include (account,contact,lead,opportunity). Omit for all.",
        ),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=50, description="Maximum results.")] = 25,
) -> SearchResponse:
    """Full-text-ish search across accounts, contacts, leads, and opportunities.

    Results are tenant-scoped. Requires ``search:read``.
    """
    if len(q.strip()) < 2:
        raise ValidationError("Search query must be at least 2 characters long.")
    entity_types: list[str] | None = None
    if types:
        entity_types = [t.strip().lower() for t in types.split(",") if t.strip()]

    service = SearchService(session)
    return await service.search(
        tenant_id=tenant.id,
        query=q,
        entity_types=entity_types,
        limit=limit,
    )
