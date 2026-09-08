"""Lead lifecycle: list, create, read, update, delete, convert.

Every mutation records an audit entry on the same database transaction.
Conversion runs in a single atomic transaction:
Lead + optional Account + Contact + Audit entries.
"""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import AppError, ConflictError, NotFoundError, PermissionDeniedError
from crm.core.pagination import Page, PageParams
from crm.modules.accounts.models import Account
from crm.modules.accounts.repository import AccountRepository
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext, diff
from crm.modules.contacts.models import Contact
from crm.modules.contacts.repository import ContactRepository
from crm.modules.leads.models import Lead
from crm.modules.leads.repository import DEFAULT_SORT, LeadRepository
from crm.modules.leads.schemas import (
    ConvertLeadInput,
    ConvertLeadResponse,
    LeadCreate,
    LeadRead,
    LeadUpdate,
)
from crm.modules.users.models import User


class LeadService:
    """Orchestration for lead lifecycle."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = LeadRepository(session)
        self.account_repo = AccountRepository(session)
        self.contact_repo = ContactRepository(session)
        self.audit = AuditService(session)

    async def list_leads(
        self,
        tenant_id: UUID,
        params: PageParams,
        search: str | None = None,
        status: str | None = None,
        is_converted: bool | None = None,
        owner_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "desc",
    ) -> Page[LeadRead]:
        """List leads for a tenant with filters and pagination."""
        items = await self.repo.list_leads(
            tenant_id=tenant_id,
            search=search,
            status=status,
            is_converted=is_converted,
            owner_id=owner_id,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=params.limit,
            offset=params.offset,
        )
        total = await self.repo.count_leads(
            tenant_id=tenant_id,
            search=search,
            status=status,
            is_converted=is_converted,
            owner_id=owner_id,
        )
        read_items = []
        for item in items:
            read_dto = LeadRead.model_validate(item)
            if item.converted_contact:
                read_dto.converted_contact_name = f"{item.converted_contact.first_name} {item.converted_contact.last_name}"
            if item.converted_account:
                read_dto.converted_account_name = item.converted_account.name
            read_items.append(read_dto)

        return Page.of(read_items, total, params)

    async def create_lead(
        self, actor: User, dto: LeadCreate, context: RequestContext | None = None
    ) -> LeadRead:
        """Create a new lead and emit an audit log entry."""
        tenant_id = actor.tenant_id
        lead = Lead(
            tenant_id=tenant_id,
            first_name=dto.first_name.strip(),
            last_name=dto.last_name.strip(),
            email=dto.email,
            phone=dto.phone.strip() if dto.phone else None,
            company_name=dto.company_name.strip() if dto.company_name else None,
            title=dto.title.strip() if dto.title else None,
            status=dto.status.strip() if dto.status else "new",
            source=dto.source.strip() if dto.source else None,
            notes=dto.notes.strip() if dto.notes else None,
            owner_id=dto.owner_id or actor.id,
        )
        lead = await self.repo.create(lead)

        summary = f"Created lead {lead.first_name} {lead.last_name}"
        if lead.company_name:
            summary += f" ({lead.company_name})"

        new_data = {
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "status": lead.status,
            "company_name": lead.company_name,
        }

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            entity_type=AuditEntity.LEAD,
            entity_id=lead.id,
            action=AuditAction.LEAD_CREATED,
            summary=summary,
            changes=diff({}, new_data),
        )

        return LeadRead.model_validate(lead)

    async def get_lead(self, tenant_id: UUID, lead_id: UUID) -> LeadRead:
        """Retrieve a single lead by ID, with tenant boundary enforcement."""
        lead = await self.repo.get_by_id(tenant_id, lead_id)
        if not lead or lead.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this lead.")

        read_dto = LeadRead.model_validate(lead)
        if lead.converted_contact:
            read_dto.converted_contact_name = f"{lead.converted_contact.first_name} {lead.converted_contact.last_name}"
        if lead.converted_account:
            read_dto.converted_account_name = lead.converted_account.name
        return read_dto

    async def update_lead(
        self, actor: User, lead_id: UUID, dto: LeadUpdate, context: RequestContext | None = None
    ) -> LeadRead:
        """Update an existing active lead."""
        tenant_id = actor.tenant_id
        lead = await self.repo.get_by_id(tenant_id, lead_id)
        if not lead or lead.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this lead.")

        if lead.is_converted:
            raise ConflictError("Converted leads are read-only and cannot be updated.")

        old_data = {
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "email": lead.email,
            "phone": lead.phone,
            "company_name": lead.company_name,
            "title": lead.title,
            "status": lead.status,
            "source": lead.source,
            "notes": lead.notes,
        }

        if dto.first_name is not None:
            lead.first_name = dto.first_name.strip()
        if dto.last_name is not None:
            lead.last_name = dto.last_name.strip()
        if dto.email is not None:
            lead.email = dto.email
        if dto.phone is not None:
            lead.phone = dto.phone.strip() if dto.phone else None
        if dto.company_name is not None:
            lead.company_name = dto.company_name.strip() if dto.company_name else None
        if dto.title is not None:
            lead.title = dto.title.strip() if dto.title else None
        if dto.status is not None:
            lead.status = dto.status.strip() if dto.status else "new"
        if dto.source is not None:
            lead.source = dto.source.strip() if dto.source else None
        if dto.notes is not None:
            lead.notes = dto.notes.strip() if dto.notes else None
        if dto.owner_id is not None:
            lead.owner_id = dto.owner_id

        lead = await self.repo.update(lead)

        new_data = {
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "email": lead.email,
            "phone": lead.phone,
            "company_name": lead.company_name,
            "title": lead.title,
            "status": lead.status,
            "source": lead.source,
            "notes": lead.notes,
        }

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            entity_type=AuditEntity.LEAD,
            entity_id=lead.id,
            action=AuditAction.LEAD_UPDATED,
            summary=f"Updated lead {lead.first_name} {lead.last_name}",
            changes=diff(old_data, new_data),
        )

        return await self.get_lead(tenant_id, lead.id)

    async def delete_lead(
        self, actor: User, lead_id: UUID, context: RequestContext | None = None
    ) -> None:
        """Delete a lead record."""
        tenant_id = actor.tenant_id
        lead = await self.repo.get_by_id(tenant_id, lead_id)
        if not lead or lead.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this lead.")

        lead_name = f"{lead.first_name} {lead.last_name}"
        old_data = {"first_name": lead.first_name, "last_name": lead.last_name}
        await self.repo.delete(tenant_id, lead_id)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            entity_type=AuditEntity.LEAD,
            entity_id=lead_id,
            action=AuditAction.LEAD_DELETED,
            summary=f"Deleted lead {lead_name}",
            changes=diff(old_data, {}),
        )

    async def convert_lead(
        self, actor: User, lead_id: UUID, dto: ConvertLeadInput, context: RequestContext | None = None
    ) -> ConvertLeadResponse:
        """Convert a qualified lead to a Contact + optional Account in one single DB transaction.

        If any step fails, the entire transaction rolls back cleanly.
        """
        tenant_id = actor.tenant_id
        lead = await self.repo.get_by_id(tenant_id, lead_id)
        if not lead or lead.tenant_id != tenant_id:
            raise PermissionDeniedError("You do not have access to this lead.")

        if lead.is_converted:
            raise ConflictError("Lead is already converted.", code="already_converted")

        target_account_id: UUID | None = None
        account_created: Account | None = None

        # 1. Resolve Account
        if dto.account_id:
            account = await self.account_repo.get_by_id(tenant_id, dto.account_id)
            if not account or account.tenant_id != tenant_id:
                raise PermissionDeniedError("The specified account does not exist or belongs to another organization.")
            target_account_id = account.id
        elif dto.create_account or dto.account_name or lead.company_name:
            account_name = (
                dto.account_name.strip()
                if dto.account_name and dto.account_name.strip()
                else (
                    lead.company_name.strip()
                    if lead.company_name and lead.company_name.strip()
                    else f"{lead.first_name} {lead.last_name} Account"
                )
            )
            account_created = Account(
                tenant_id=tenant_id,
                name=account_name,
                owner_id=lead.owner_id or actor.id,
            )
            account_created = await self.account_repo.create(account_created)
            target_account_id = account_created.id

            self.audit.record(
                tenant_id=tenant_id,
                actor=actor,
                context=context,
                entity_type=AuditEntity.ACCOUNT,
                entity_id=account_created.id,
                action=AuditAction.ACCOUNT_CREATED,
                summary=f"Created account {account_created.name} via lead conversion",
                changes=diff({}, {"name": account_created.name}),
            )

        # 2. Create Contact from Lead information
        contact = Contact(
            tenant_id=tenant_id,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=lead.email,
            phone=lead.phone,
            title=lead.title,
            account_id=target_account_id,
            owner_id=lead.owner_id or actor.id,
        )
        contact = await self.contact_repo.create(contact)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            entity_type=AuditEntity.CONTACT,
            entity_id=contact.id,
            action=AuditAction.CONTACT_CREATED,
            summary=f"Created contact {contact.first_name} {contact.last_name} via lead conversion",
            changes=diff({}, {"first_name": contact.first_name, "last_name": contact.last_name, "email": contact.email}),
        )

        # 3. Update Lead state
        old_lead_status = lead.status
        lead.status = "converted"
        lead.is_converted = True
        lead.converted_at = datetime.now(timezone.utc)
        lead.converted_contact_id = contact.id
        lead.converted_account_id = target_account_id

        lead = await self.repo.update(lead)

        summary = f"Converted lead {lead.first_name} {lead.last_name} to contact"
        if account_created:
            summary += f" and created account {account_created.name}"
        elif target_account_id:
            summary += " and linked to existing account"

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            entity_type=AuditEntity.LEAD,
            entity_id=lead.id,
            action=AuditAction.LEAD_CONVERTED,
            summary=summary,
            changes=diff({"status": old_lead_status, "is_converted": False}, {"status": "converted", "is_converted": True}),
        )

        lead_dto = await self.get_lead(tenant_id, lead.id)

        return ConvertLeadResponse(
            lead=lead_dto,
            contact_id=contact.id,
            account_id=target_account_id,
        )
