"""Accounts HTTP router.

Reads require `accounts:read`; writes require `accounts:write`.
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
from crm.modules.accounts.repository import DEFAULT_SORT, SORTABLE_FIELDS
from crm.modules.accounts.schemas import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
)
from crm.modules.accounts.service import AccountService
from crm.modules.users.models import User

router = APIRouter(prefix="/accounts", tags=["accounts"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.ACCOUNTS_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.ACCOUNTS_WRITE))]


@router.get(
    "",
    response_model=Page[AccountRead],
    summary="List accounts in the current tenant",
)
async def list_accounts(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    q: Annotated[
        str | None, Query(max_length=255, description="Search by name, industry, website, address.")
    ] = None,
    industry: Annotated[
        str | None, Query(max_length=100, description="Filter by industry.")
    ] = None,
    owner_id: Annotated[UUID | None, Query(description="Filter by owner user ID.")] = None,
    sort: Annotated[str, Query(description="Sort column.")] = DEFAULT_SORT,
    desc: Annotated[bool, Query(description="Sort descending.")] = False,
) -> Page[AccountRead]:
    """Accounts belonging to the caller's tenant. Requires `accounts:read`."""
    if sort not in SORTABLE_FIELDS:
        sort = DEFAULT_SORT

    service = AccountService(session)
    return await service.list_accounts(
        tenant_id=tenant.id,
        params=page,
        search=q,
        industry=industry,
        owner_id=owner_id,
        sort_by=sort,
        sort_dir="desc" if desc else "asc",
    )


@router.post(
    "",
    response_model=AccountRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new account",
)
async def create_account(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    payload: AccountCreate,
    ctx: RequestContextDep,
) -> AccountRead:
    """Create an account in the caller's tenant. Requires `accounts:write`."""
    service = AccountService(session)
    account = await service.create_account(actor, payload, ctx)
    await session.commit()
    await session.refresh(account)
    return AccountRead.model_validate(account)


@router.get(
    "/{account_id}",
    response_model=AccountRead,
    summary="Get account detail",
)
async def get_account(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    account_id: UUID,
) -> AccountRead:
    """Fetch a single account by ID in the caller's tenant. Requires `accounts:read`."""
    service = AccountService(session)
    account = await service.get_account_in_tenant(tenant.id, account_id)
    return AccountRead.model_validate(account)


@router.patch(
    "/{account_id}",
    response_model=AccountRead,
    summary="Update an account",
)
async def update_account(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    account_id: UUID,
    payload: AccountUpdate,
    ctx: RequestContextDep,
) -> AccountRead:
    """Update an account in the caller's tenant. Requires `accounts:write`."""
    service = AccountService(session)
    account = await service.update_account(actor, account_id, payload, ctx)
    await session.commit()
    await session.refresh(account)
    return AccountRead.model_validate(account)


@router.delete(
    "/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an account",
)
async def delete_account(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    account_id: UUID,
    ctx: RequestContextDep,
) -> None:
    """Delete an account in the caller's tenant. Requires `accounts:write`."""
    service = AccountService(session)
    await service.delete_account(actor, account_id, ctx)
    await session.commit()
