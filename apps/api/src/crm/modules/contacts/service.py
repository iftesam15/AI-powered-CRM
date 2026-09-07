"""Contact lifecycle: list, create, read, update, delete, duplicate check.

Every mutation records an audit entry on the same database transaction.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import NotFoundError, PermissionDeniedError
from crm.core.pagination import Page, PageParams
from crm.modules.accounts.repository import AccountRepository
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext, diff
from crm.modules.contacts.models import Contact
from crm.modules.contacts.repository import DEFAULT_SORT, ContactRepository
from crm.modules.contacts.schemas import (
    ContactCreate,
    ContactDuplicateCheckResponse,
    ContactRead,
    ContactUpdate,
)
from crm.modules.users.models import User


class ContactService:
    """Orchestration for contact lifecycle."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ContactRepository(session)
        self.account_repo = AccountRepository(session)
        self.audit = AuditService(session)

    async def list_contacts(
        self,
        tenant_id: UUID,
        params: PageParams,
        search: str | None = None,
        account_id: UUID | None = None,
        owner_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "asc",
    ) -> Page[ContactRead]:
        """List contacts for a tenant with filters and pagination."""
        items = await self.repo.list_contacts(
            tenant_id=tenant_id,
            search=search,
            account_id=account_id,
            owner_id=owner_id,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=params.limit,
            offset=params.offset,
        )
        total = await self.repo.count_contacts(
            tenant_id=tenant_id,
            search=search,
            account_id=account_id,
            owner_id=owner_id,
        )
        read_items = []
        for item in items:
            read_dto = ContactRead.model_validate(item)
            if item.account:
                read_dto.account_name = item.account.name
            read_items.append(read_dto)

        return Page.of(
            items=read_items,
            total=total,
            params=params,
        )

    async def get_contact_in_tenant(self, tenant_id: UUID, contact_id: UUID) -> Contact:
        """Tenant-scoped lookup.

        Returns 403 PermissionDeniedError if the contact belongs to another tenant
        or does not exist, to prevent tenant ID probing.
        """
        contact = await self.repo.get_by_id(tenant_id, contact_id)
        if not contact:
            raise PermissionDeniedError("You do not have access to this contact.")
        return contact

    async def get_contacts_for_account(self, tenant_id: UUID, account_id: UUID) -> list[ContactRead]:
        """Get all contacts belonging to an account in tenant."""
        # Ensure account exists in tenant
        account = await self.account_repo.get_by_id(tenant_id, account_id)
        if not account:
            raise PermissionDeniedError("You do not have access to this account.")
        contacts = await self.repo.get_by_account_id(tenant_id, account_id)
        res = []
        for c in contacts:
            dto = ContactRead.model_validate(c)
            dto.account_name = account.name
            res.append(dto)
        return res

    async def create_contact(
        self,
        actor: User,
        payload: ContactCreate,
        context: RequestContext | None = None,
    ) -> Contact:
        """Create a new contact in the actor's tenant."""
        tenant_id = actor.tenant_id

        if payload.account_id:
            account = await self.account_repo.get_by_id(tenant_id, payload.account_id)
            if not account:
                raise PermissionDeniedError("Specified account does not belong to your organization.")

        contact = Contact(
            tenant_id=tenant_id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            email=payload.email,
            phone=payload.phone.strip() if payload.phone else None,
            title=payload.title.strip() if payload.title else None,
            account_id=payload.account_id,
            owner_id=payload.owner_id or actor.id,
        )
        created = await self.repo.create(contact)

        full_name = f"{created.first_name} {created.last_name}"
        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            action=AuditAction.CONTACT_CREATED,
            entity_type=AuditEntity.CONTACT,
            entity_id=created.id,
            summary=f"Created contact '{full_name}'",
            changes=diff({}, {"name": full_name, "email": created.email}),
        )
        return created

    async def update_contact(
        self,
        actor: User,
        contact_id: UUID,
        payload: ContactUpdate,
        context: RequestContext | None = None,
    ) -> Contact:
        """Update an existing contact in the actor's tenant."""
        tenant_id = actor.tenant_id
        contact = await self.get_contact_in_tenant(tenant_id, contact_id)

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return contact

        if "account_id" in update_data and update_data["account_id"] is not None:
            account = await self.account_repo.get_by_id(tenant_id, update_data["account_id"])
            if not account:
                raise PermissionDeniedError("Specified account does not belong to your organization.")

        old_state: dict[str, Any] = {
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "phone": contact.phone,
            "title": contact.title,
            "account_id": str(contact.account_id) if contact.account_id else None,
            "owner_id": str(contact.owner_id) if contact.owner_id else None,
        }

        for key, val in update_data.items():
            if hasattr(contact, key):
                if isinstance(val, str):
                    val = val.strip() if val else None
                setattr(contact, key, val)

        await self.session.flush()

        new_state: dict[str, Any] = {
            "first_name": contact.first_name,
            "last_name": contact.last_name,
            "email": contact.email,
            "phone": contact.phone,
            "title": contact.title,
            "account_id": str(contact.account_id) if contact.account_id else None,
            "owner_id": str(contact.owner_id) if contact.owner_id else None,
        }

        changes = diff(old_state, new_state)
        if changes:
            full_name = f"{contact.first_name} {contact.last_name}"
            self.audit.record(
                tenant_id=tenant_id,
                actor=actor,
                context=context,
                action=AuditAction.CONTACT_UPDATED,
                entity_type=AuditEntity.CONTACT,
                entity_id=contact.id,
                summary=f"Updated contact '{full_name}'",
                changes=changes,
            )

        return contact

    async def delete_contact(
        self,
        actor: User,
        contact_id: UUID,
        context: RequestContext | None = None,
    ) -> None:
        """Delete a contact in the actor's tenant."""
        tenant_id = actor.tenant_id
        contact = await self.get_contact_in_tenant(tenant_id, contact_id)
        full_name = f"{contact.first_name} {contact.last_name}"

        deleted = await self.repo.delete(tenant_id, contact_id)
        if not deleted:
            raise NotFoundError("Contact not found.")

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            action=AuditAction.CONTACT_DELETED,
            entity_type=AuditEntity.CONTACT,
            entity_id=contact_id,
            summary=f"Deleted contact '{full_name}'",
            changes=diff({"name": full_name}, {}),
        )

    async def check_duplicate_email(
        self, tenant_id: UUID, email: str
    ) -> ContactDuplicateCheckResponse:
        """Check for contacts with the given email address in the tenant."""
        matches = await self.repo.find_by_email(tenant_id, email)
        read_matches = []
        for m in matches:
            dto = ContactRead.model_validate(m)
            if m.account:
                dto.account_name = m.account.name
            read_matches.append(dto)

        return ContactDuplicateCheckResponse(
            is_duplicate=len(matches) > 0,
            matching_count=len(matches),
            matching_contacts=read_matches,
        )
