"""Opportunities HTTP router."""

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
from crm.modules.opportunities.repository import DEFAULT_SORT, SORTABLE_FIELDS
from crm.modules.opportunities.schemas import (
    CloseLostInput,
    CloseWonInput,
    OpportunityCreate,
    OpportunityRead,
    OpportunityUpdate,
    PipelineSummaryResponse,
    StageMoveInput,
)
from crm.modules.opportunities.service import OpportunityService
from crm.modules.users.models import User

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.OPPORTUNITIES_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.OPPORTUNITIES_WRITE))]


@router.get(
    "",
    response_model=Page[OpportunityRead],
    summary="List opportunities in the current tenant",
)
async def list_opportunities(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    q: Annotated[
        str | None,
        Query(max_length=255, description="Search by opportunity name or notes."),
    ] = None,
    pipeline_id: Annotated[UUID | None, Query(description="Filter by pipeline ID.")] = None,
    stage_id: Annotated[UUID | None, Query(description="Filter by stage ID.")] = None,
    opp_status: Annotated[
        str | None,
        Query(alias="status", description="Filter by status (open, won, lost)."),
    ] = None,
    owner_id: Annotated[UUID | None, Query(description="Filter by owner user ID.")] = None,
    account_id: Annotated[UUID | None, Query(description="Filter by account ID.")] = None,
    sort: Annotated[str, Query(description="Sort column.")] = DEFAULT_SORT,
    order: Annotated[str, Query(pattern="^(asc|desc)$", description="Sort direction.")] = "desc",
) -> Page[OpportunityRead]:
    service = OpportunityService(session)
    sort_by = sort if sort in SORTABLE_FIELDS else DEFAULT_SORT
    return await service.list_opportunities(
        tenant_id=tenant.id,
        params=page,
        search=q,
        pipeline_id=pipeline_id,
        stage_id=stage_id,
        status=opp_status,
        owner_id=owner_id,
        account_id=account_id,
        sort_by=sort_by,
        sort_dir=order,
    )


@router.get(
    "/summary",
    response_model=PipelineSummaryResponse,
    summary="Get pipeline forecast and stage breakdown summary",
)
async def get_pipeline_summary(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    pipeline_id: Annotated[UUID | None, Query(description="Optional pipeline ID.")] = None,
) -> PipelineSummaryResponse:
    service = OpportunityService(session)
    return await service.get_pipeline_summary(tenant.id, pipeline_id)


@router.get(
    "/{opp_id}",
    response_model=OpportunityRead,
    summary="Retrieve single opportunity by ID with stage history",
)
async def get_opportunity(
    _: ReadAccess,
    tenant: CurrentTenant,
    opp_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> OpportunityRead:
    service = OpportunityService(session)
    return await service.get_opportunity(tenant.id, opp_id)


@router.post(
    "",
    response_model=OpportunityRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new opportunity",
)
async def create_opportunity(
    actor: WriteAccess,
    payload: OpportunityCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> OpportunityRead:
    service = OpportunityService(session)
    result = await service.create_opportunity(actor, payload, context)
    await session.commit()
    return result


@router.patch(
    "/{opp_id}",
    response_model=OpportunityRead,
    summary="Update opportunity fields",
)
async def update_opportunity(
    actor: WriteAccess,
    opp_id: UUID,
    payload: OpportunityUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> OpportunityRead:
    service = OpportunityService(session)
    result = await service.update_opportunity(actor, opp_id, payload, context)
    await session.commit()
    return result


@router.post(
    "/{opp_id}/move-stage",
    response_model=OpportunityRead,
    summary="Move opportunity to another stage",
)
async def move_stage(
    actor: WriteAccess,
    opp_id: UUID,
    payload: StageMoveInput,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> OpportunityRead:
    service = OpportunityService(session)
    result = await service.move_stage(actor, opp_id, payload, context)
    await session.commit()
    return result


@router.post(
    "/{opp_id}/won",
    response_model=OpportunityRead,
    summary="Mark opportunity as Closed Won",
)
async def close_won(
    actor: WriteAccess,
    opp_id: UUID,
    payload: CloseWonInput,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> OpportunityRead:
    service = OpportunityService(session)
    result = await service.close_won(actor, opp_id, payload, context)
    await session.commit()
    return result


@router.post(
    "/{opp_id}/lost",
    response_model=OpportunityRead,
    summary="Mark opportunity as Closed Lost (loss_reason mandatory)",
)
async def close_lost(
    actor: WriteAccess,
    opp_id: UUID,
    payload: CloseLostInput,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> OpportunityRead:
    service = OpportunityService(session)
    result = await service.close_lost(actor, opp_id, payload, context)
    await session.commit()
    return result


@router.delete(
    "/{opp_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an opportunity",
)
async def delete_opportunity(
    actor: WriteAccess,
    opp_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> None:
    service = OpportunityService(session)
    await service.delete_opportunity(actor, opp_id, context)
    await session.commit()
