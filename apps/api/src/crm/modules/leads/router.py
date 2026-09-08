"""Leads HTTP router.

Reads require `leads:read`; writes require `leads:write`.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import (
    CurrentTenant,
    RequestContextDep,
    require_permission,
)
from crm.core.pagination import Page, PageParamsDep
from crm.core.rbac import Permission
from crm.modules.leads.repository import DEFAULT_SORT, SORTABLE_FIELDS
from crm.modules.leads.schemas import (
    ConvertLeadInput,
    ConvertLeadResponse,
    LeadCreate,
    LeadRead,
    LeadUpdate,
)
from crm.modules.leads.service import LeadService
from crm.modules.users.models import User

router = APIRouter(prefix="/leads", tags=["leads"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.LEADS_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.LEADS_WRITE))]


@router.get(
    "",
    response_model=Page[LeadRead],
    summary="List leads in the current tenant",
)
async def list_leads(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    q: Annotated[
        str | None,
        Query(max_length=255, description="Search by name, email, phone, company, title."),
    ] = None,
    lead_status: Annotated[
        str | None,
        Query(alias="status", description="Filter by lead status (e.g. new, contacted, qualified, unqualified, converted)."),
    ] = None,
    is_converted: Annotated[
        bool | None,
        Query(description="Filter by conversion state."),
    ] = None,
    owner_id: Annotated[UUID | None, Query(description="Filter by owner user ID.")] = None,
    sort: Annotated[str, Query(description="Sort column.")] = DEFAULT_SORT,
    desc: Annotated[bool, Query(description="Sort descending.")] = True,
) -> Page[LeadRead]:
    """Leads belonging to the caller's tenant. Requires `leads:read`."""
    if sort not in SORTABLE_FIELDS:
        sort = DEFAULT_SORT

    service = LeadService(session)
    return await service.list_leads(
        tenant_id=tenant.id,
        params=page,
        search=q,
        status=lead_status,
        is_converted=is_converted,
        owner_id=owner_id,
        sort_by=sort,
        sort_dir="desc" if desc else "asc",
    )


@router.post(
    "",
    response_model=LeadRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new lead",
)
async def create_lead(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    dto: LeadCreate,
    ctx: RequestContextDep,
) -> LeadRead:
    """Create a new lead under the caller's tenant. Requires `leads:write`."""
    service = LeadService(session)
    result = await service.create_lead(actor=actor, dto=dto, context=ctx)
    await session.commit()
    return result


@router.get(
    "/{lead_id}",
    response_model=LeadRead,
    summary="Get a lead by ID",
)
async def get_lead(
    lead_id: UUID,
    actor: ReadAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> LeadRead:
    """Retrieve a single lead record. Requires `leads:read`."""
    service = LeadService(session)
    return await service.get_lead(tenant_id=actor.tenant_id, lead_id=lead_id)


@router.patch(
    "/{lead_id}",
    response_model=LeadRead,
    summary="Update an existing lead",
)
async def update_lead(
    lead_id: UUID,
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    dto: LeadUpdate,
    ctx: RequestContextDep,
) -> LeadRead:
    """Update lead fields. Requires `leads:write`."""
    service = LeadService(session)
    result = await service.update_lead(actor=actor, lead_id=lead_id, dto=dto, context=ctx)
    await session.commit()
    return result


@router.delete(
    "/{lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a lead",
)
async def delete_lead(
    lead_id: UUID,
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    ctx: RequestContextDep,
) -> None:
    """Delete a lead record. Requires `leads:write`."""
    service = LeadService(session)
    await service.delete_lead(actor=actor, lead_id=lead_id, context=ctx)
    await session.commit()


@router.post(
    "/{lead_id}/convert",
    response_model=ConvertLeadResponse,
    summary="Convert a qualified lead into a Contact and optional Account",
)
async def convert_lead(
    lead_id: UUID,
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    dto: ConvertLeadInput,
    ctx: RequestContextDep,
) -> ConvertLeadResponse:
    """Convert a lead to Contact + optional Account in a single transaction. Requires `leads:write`."""
    service = LeadService(session)
    result = await service.convert_lead(actor=actor, lead_id=lead_id, dto=dto, context=ctx)
    await session.commit()
    return result

