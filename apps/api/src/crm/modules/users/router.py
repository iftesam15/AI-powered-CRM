"""User administration HTTP router.

Reads need `users:read` (Sales Manager and Administrator); writes need
`users:write` (Administrator only). The permission is re-checked on every call
from the role in the session, so a role change takes effect on the next
request without anyone having to sign out.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import (
    CurrentTenant,
    RequestContextDep,
    require_permission,
)
from crm.core.pagination import Page, PageParamsDep
from crm.core.rbac import Permission, Role
from crm.modules.users.models import User
from crm.modules.users.repository import DEFAULT_SORT, SORTABLE_FIELDS
from crm.modules.users.schemas import (
    RoleRead,
    UserAdminCreate,
    UserRead,
    UserUpdate,
)
from crm.modules.users.service import UserService

router = APIRouter(prefix="/users", tags=["users"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.USERS_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.USERS_WRITE))]


@router.get(
    "",
    response_model=Page[UserRead],
    summary="List users in the current tenant",
)
async def list_users(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    q: Annotated[str | None, Query(max_length=255, description="Name or email.")] = None,
    role: Annotated[Role | None, Query(description="Filter by role.")] = None,
    is_active: Annotated[bool | None, Query(description="Filter by status.")] = None,
    sort: Annotated[str, Query(description="Sort column.")] = DEFAULT_SORT,
    desc: Annotated[bool, Query(description="Sort descending.")] = False,
) -> Page[UserRead]:
    """Users belonging to the caller's tenant. Requires `users:read`."""
    if sort not in SORTABLE_FIELDS:
        sort = DEFAULT_SORT

    service = UserService(session)
    users, total = await service.list_users(
        tenant.id,
        limit=page.limit,
        offset=page.offset,
        search=q,
        role=str(role) if role else None,
        is_active=is_active,
        sort=sort,
        descending=desc,
    )
    return Page.of([UserRead.model_validate(user) for user in users], total, page)


@router.get(
    "/roles",
    response_model=list[RoleRead],
    summary="List assignable roles and their permissions",
)
async def list_roles(_: ReadAccess) -> list[RoleRead]:
    """Role catalogue for the admin UI, so the web app hardcodes no permissions.

    Declared before `/{user_id}` so the literal path is not swallowed by the
    UUID route.
    """
    return UserService.list_roles()


@router.get(
    "/{user_id}",
    response_model=UserRead,
    summary="Get one user",
)
async def get_user(
    user_id: UUID,
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    """Requires `users:read`. Another tenant's id answers 403."""
    service = UserService(session)
    user = await service.get_user_in_tenant(tenant.id, user_id)
    return UserRead.model_validate(user)


@router.post(
    "",
    response_model=UserRead,
    status_code=201,
    summary="Create a user",
)
async def create_user(
    payload: UserAdminCreate,
    actor: WriteAccess,
    context: RequestContextDep,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    """Create a user in the caller's tenant. Requires `users:write`.

    The new user lands in the actor's tenant; the body has no say in that.
    """
    service = UserService(session)
    user = await service.create_user_as_admin(actor, payload, context)
    return UserRead.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserRead,
    summary="Update a user's name, role or status",
)
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    actor: WriteAccess,
    context: RequestContextDep,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    """Requires `users:write`.

    Refuses self-deactivation, self role change, and any edit that would leave
    the tenant without an active administrator.
    """
    service = UserService(session)
    user = await service.update_user(actor, user_id, payload, context)
    return UserRead.model_validate(user)
