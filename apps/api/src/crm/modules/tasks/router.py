"""FastAPI router for tasks domain module."""

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
from crm.modules.tasks.schemas import TaskCreate, TaskRead, TaskUpdate
from crm.modules.tasks.service import TaskService
from crm.modules.users.models import User

router = APIRouter(prefix="/tasks", tags=["tasks"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.TASKS_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.TASKS_WRITE))]


@router.post(
    "",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task",
)
async def create_task(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    payload: TaskCreate,
    ctx: RequestContextDep,
) -> TaskRead:
    service = TaskService(session)
    result = await service.create_task(payload, actor)
    await session.commit()
    return result


@router.get(
    "",
    response_model=Page[TaskRead],
    summary="List tasks",
)
async def list_tasks(
    actor: ReadAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    status_filter: str | None = Query(None, alias="status"),
    priority_filter: str | None = Query(None, alias="priority"),
    assigned_to_id: uuid.UUID | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: uuid.UUID | None = Query(None),
) -> Page[TaskRead]:
    service = TaskService(session)
    items, total = await service.list_tasks(
        current_user=actor,
        status_filter=status_filter,
        priority_filter=priority_filter,
        assigned_to_id=assigned_to_id,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=page.limit,
        offset=page.offset,
    )
    return Page.of(items=items, total=total, params=page)


@router.get(
    "/{task_id}",
    response_model=TaskRead,
    summary="Get task details by ID",
)
async def get_task(
    actor: ReadAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: uuid.UUID,
) -> TaskRead:
    service = TaskService(session)
    return await service.get_task(task_id, actor)


@router.patch(
    "/{task_id}",
    response_model=TaskRead,
    summary="Update a task",
)
async def update_task(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: uuid.UUID,
    payload: TaskUpdate,
) -> TaskRead:
    service = TaskService(session)
    result = await service.update_task(task_id, payload, actor)
    await session.commit()
    return result


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task",
)
async def delete_task(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: uuid.UUID,
) -> None:
    service = TaskService(session)
    await service.delete_task(task_id, actor)
    await session.commit()

