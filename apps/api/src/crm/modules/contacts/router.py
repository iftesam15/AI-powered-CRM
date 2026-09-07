"""Contacts HTTP router.

Reads require `contacts:read`; writes require `contacts:write`.
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
from crm.modules.contacts.repository import DEFAULT_SORT, SORTABLE_FIELDS
from crm.modules.contacts.schemas import (
    ContactCreate,
    ContactDuplicateCheckResponse,
    ContactRead,
    ContactUpdate,
)
from crm.modules.contacts.service import ContactService
from crm.modules.users.models import User

router = APIRouter(prefix="/contacts", tags=["contacts"])

ReadAccess = Annotated[User, Depends(require_permission(Permission.CONTACTS_READ))]
WriteAccess = Annotated[User, Depends(require_permission(Permission.CONTACTS_WRITE))]


@router.get(
    "",
    response_model=Page[ContactRead],
    summary="List contacts in the current tenant",
)
async def list_contacts(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    q: Annotated[
        str | None,
        Query(max_length=255, description="Search by name, email, phone, title."),
    ] = None,
    account_id: Annotated[UUID | None, Query(description="Filter by linked account ID.")] = None,
    owner_id: Annotated[UUID | None, Query(description="Filter by owner user ID.")] = None,
    sort: Annotated[str, Query(description="Sort column.")] = DEFAULT_SORT,
    desc: Annotated[bool, Query(description="Sort descending.")] = False,
) -> Page[ContactRead]:
    """Contacts belonging to the caller's tenant. Requires `contacts:read`."""
    if sort not in SORTABLE_FIELDS:
        sort = DEFAULT_SORT

    service = ContactService(session)
    return await service.list_contacts(
        tenant_id=tenant.id,
        params=page,
        search=q,
        account_id=account_id,
        owner_id=owner_id,
        sort_by=sort,
        sort_dir="desc" if desc else "asc",
    )


@router.get(
    "/check-duplicate",
    response_model=ContactDuplicateCheckResponse,
    summary="Check if a contact email already exists in the tenant",
)
async def check_duplicate(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    email: Annotated[str, Query(description="Email address to check.")],
) -> ContactDuplicateCheckResponse:
    """Check duplicate contact by email within tenant. Requires `contacts:read`."""
    service = ContactService(session)
    return await service.check_duplicate_email(tenant.id, email)


@router.post(
    "",
    response_model=ContactRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new contact",
)
async def create_contact(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    payload: ContactCreate,
    ctx: RequestContextDep,
) -> ContactRead:
    """Create a contact in the caller's tenant. Requires `contacts:write`."""
    service = ContactService(session)
    contact = await service.create_contact(actor, payload, ctx)
    await session.commit()
    await session.refresh(contact)
    read_dto = ContactRead.model_validate(contact)
    if contact.account:
        read_dto.account_name = contact.account.name
    return read_dto


@router.get(
    "/{contact_id}",
    response_model=ContactRead,
    summary="Get contact detail",
)
async def get_contact(
    _: ReadAccess,
    tenant: CurrentTenant,
    session: Annotated[AsyncSession, Depends(get_db)],
    contact_id: UUID,
) -> ContactRead:
    """Fetch a single contact by ID in the caller's tenant. Requires `contacts:read`."""
    service = ContactService(session)
    contact = await service.get_contact_in_tenant(tenant.id, contact_id)
    read_dto = ContactRead.model_validate(contact)
    if contact.account:
        read_dto.account_name = contact.account.name
    return read_dto


@router.patch(
    "/{contact_id}",
    response_model=ContactRead,
    summary="Update a contact",
)
async def update_contact(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    contact_id: UUID,
    payload: ContactUpdate,
    ctx: RequestContextDep,
) -> ContactRead:
    """Update a contact in the caller's tenant. Requires `contacts:write`."""
    service = ContactService(session)
    contact = await service.update_contact(actor, contact_id, payload, ctx)
    await session.commit()
    await session.refresh(contact)
    read_dto = ContactRead.model_validate(contact)
    if contact.account:
        read_dto.account_name = contact.account.name
    return read_dto


@router.delete(
    "/{contact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a contact",
)
async def delete_contact(
    actor: WriteAccess,
    session: Annotated[AsyncSession, Depends(get_db)],
    contact_id: UUID,
    ctx: RequestContextDep,
) -> None:
    """Delete a contact in the caller's tenant. Requires `contacts:write`."""
    service = ContactService(session)
    await service.delete_contact(actor, contact_id, ctx)
    await session.commit()
