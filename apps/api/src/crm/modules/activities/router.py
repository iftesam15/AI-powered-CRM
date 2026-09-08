"""FastAPI router for activities domain module."""

import uuid
from typing import Annotated

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
from crm.modules.activities.schemas import ActivityCreate, ActivityRead, TimelineItemRead
from crm.modules.activities.service import ActivityService
from crm.modules.users.models import User

router = APIRouter(prefix="/activities", tags=["activities"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.ACTIVITIES_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.ACTIVITIES_WRITE))]


@router.post(
    "",
    response_model=ActivityRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log a new activity",
)
async def create_activity(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    payload: ActivityCreate,
    ctx: RequestContextDep,
) -> ActivityRead:
    service = ActivityService(session)
    result = await service.create_activity(payload, actor)
    await session.commit()
    return result



@router.get(
    "/timeline",
    response_model=list[TimelineItemRead],
    summary="Get aggregated activity and task timeline for an entity",
)
async def get_timeline(
    actor: ReadAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    entity_type: str = Query(..., description="Target entity type (account or contact)"),
    entity_id: uuid.UUID = Query(..., description="Target entity UUID"),
    limit: int = Query(50, ge=1, le=100),
) -> list[TimelineItemRead]:
    service = ActivityService(session)
    return await service.get_timeline(entity_type, entity_id, actor, limit=limit)


@router.get(
    "",
    response_model=Page[ActivityRead],
    summary="List activities",
)
async def list_activities(
    actor: ReadAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    activity_type: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: uuid.UUID | None = Query(None),
) -> Page[ActivityRead]:
    service = ActivityService(session)
    items, total = await service.list_activities(
        current_user=actor,
        activity_type=activity_type,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=page.limit,
        offset=page.offset,
    )
    return Page.of(items=items, total=total, params=page)


@router.get(
    "/{activity_id}",
    response_model=ActivityRead,
    summary="Get activity details by ID",
)
async def get_activity(
    actor: ReadAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    activity_id: uuid.UUID,
) -> ActivityRead:
    service = ActivityService(session)
    return await service.get_activity(activity_id, actor)


@router.delete(
    "/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an activity",
)
async def delete_activity(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    activity_id: uuid.UUID,
) -> None:
    service = ActivityService(session)
    await service.delete_activity(activity_id, actor)
    await session.commit()

