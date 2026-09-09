"""Pipelines and Pipeline Stages HTTP router."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import (
    CurrentTenant,
    RequestContextDep,
    require_permission,
)
from crm.core.rbac import Permission
from crm.modules.pipelines.schemas import (
    PipelineResponse,
    PipelineStageCreate,
    PipelineStageReorderRequest,
    PipelineStageResponse,
    PipelineStageUpdate,
)
from crm.modules.pipelines.service import PipelineService
from crm.modules.users.models import User

router = APIRouter(prefix="/pipelines", tags=["pipelines"])

PipelineReadAccess = Annotated[User, Depends(require_permission(Permission.PIPELINE_READ))]
PipelineConfigAccess = Annotated[User, Depends(require_permission(Permission.PIPELINE_CONFIGURE))]


@router.get(
    "",
    response_model=list[PipelineResponse],
    summary="List all pipelines for tenant",
)
async def list_pipelines(
    _: PipelineReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[PipelineResponse]:
    service = PipelineService(session)
    return await service.list_pipelines(tenant.id)


@router.get(
    "/default",
    response_model=PipelineResponse,
    summary="Get default pipeline with stages",
)
async def get_default_pipeline(
    _: PipelineReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PipelineResponse:
    service = PipelineService(session)
    return await service.get_default_pipeline(tenant.id)


@router.get(
    "/{pipeline_id}",
    response_model=PipelineResponse,
    summary="Get pipeline by ID with stages",
)
async def get_pipeline(
    _: PipelineReadAccess,
    tenant: CurrentTenant,
    pipeline_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> PipelineResponse:
    service = PipelineService(session)
    return await service.get_pipeline(tenant.id, pipeline_id)


@router.post(
    "/{pipeline_id}/stages",
    response_model=PipelineStageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new stage in pipeline",
)
async def create_stage(
    actor: PipelineConfigAccess,
    pipeline_id: UUID,
    payload: PipelineStageCreate,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> PipelineStageResponse:
    service = PipelineService(session)
    result = await service.create_stage(actor, pipeline_id, payload, context)
    await session.commit()
    return result


@router.patch(
    "/{pipeline_id}/stages/{stage_id}",
    response_model=PipelineStageResponse,
    summary="Update a pipeline stage",
)
async def update_stage(
    actor: PipelineConfigAccess,
    pipeline_id: UUID,
    stage_id: UUID,
    payload: PipelineStageUpdate,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> PipelineStageResponse:
    service = PipelineService(session)
    result = await service.update_stage(actor, pipeline_id, stage_id, payload, context)
    await session.commit()
    return result


@router.delete(
    "/{pipeline_id}/stages/{stage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a pipeline stage",
)
async def delete_stage(
    actor: PipelineConfigAccess,
    pipeline_id: UUID,
    stage_id: UUID,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> None:
    service = PipelineService(session)
    await service.delete_stage(actor, pipeline_id, stage_id, context)
    await session.commit()


@router.post(
    "/{pipeline_id}/stages/reorder",
    response_model=list[PipelineStageResponse],
    summary="Reorder pipeline stages",
)
async def reorder_stages(
    actor: PipelineConfigAccess,
    pipeline_id: UUID,
    payload: PipelineStageReorderRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
    context: RequestContextDep,
) -> list[PipelineStageResponse]:
    service = PipelineService(session)
    result = await service.reorder_stages(actor, pipeline_id, payload, context)
    await session.commit()
    return result
