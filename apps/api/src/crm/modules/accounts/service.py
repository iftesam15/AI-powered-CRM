"""Account lifecycle: list, create, read, update, delete.

Every mutation records an audit entry on the same database transaction.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from crm.core.pagination import Page, PageParams
from crm.modules.accounts.models import Account
from crm.modules.accounts.repository import DEFAULT_SORT, AccountRepository
from crm.modules.accounts.schemas import AccountCreate, AccountRead, AccountUpdate
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext, diff
from crm.modules.users.models import User


class AccountService:
    """Orchestration for account lifecycle."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = AccountRepository(session)
        self.audit = AuditService(session)

    async def list_accounts(
        self,
        tenant_id: UUID,
        params: PageParams,
        search: str | None = None,
        industry: str | None = None,
        owner_id: UUID | None = None,
        sort_by: str = DEFAULT_SORT,
        sort_dir: str = "asc",
    ) -> Page[AccountRead]:
        """List accounts for a tenant with filters and pagination."""
        items = await self.repo.list_accounts(
            tenant_id=tenant_id,
            search=search,
            industry=industry,
            owner_id=owner_id,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=params.limit,
            offset=params.offset,
        )
        total = await self.repo.count_accounts(
            tenant_id=tenant_id,
            search=search,
            industry=industry,
            owner_id=owner_id,
        )
        return Page.of(
            items=[AccountRead.model_validate(item) for item in items],
            total=total,
            params=params,
        )

    async def get_account_in_tenant(self, tenant_id: UUID, account_id: UUID) -> Account:
        """Tenant-scoped lookup.

        Returns 403 PermissionDeniedError if the account belongs to another tenant
        or does not exist, to prevent tenant ID probing.
        """
        account = await self.repo.get_by_id(tenant_id, account_id)
        if not account:
            raise PermissionDeniedError("You do not have access to this account.")
        return account

    async def create_account(
        self,
        actor: User,
        payload: AccountCreate,
        context: RequestContext | None = None,
    ) -> Account:
        """Create a new account in the actor's tenant."""
        tenant_id = actor.tenant_id
        existing = await self.repo.get_by_name(tenant_id, payload.name)
        if existing:
            raise ConflictError(f"An account named '{payload.name}' already exists.")

        account = Account(
            tenant_id=tenant_id,
            name=payload.name.strip(),
            industry=payload.industry.strip() if payload.industry else None,
            size=payload.size.strip() if payload.size else None,
            website=payload.website,
            address=payload.address.strip() if payload.address else None,
            owner_id=payload.owner_id or actor.id,
        )
        created = await self.repo.create(account)

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            action=AuditAction.ACCOUNT_CREATED,
            entity_type=AuditEntity.ACCOUNT,
            entity_id=created.id,
            summary=f"Created account '{created.name}'",
            changes=diff({}, {"name": created.name, "industry": created.industry}),
        )
        return created

    async def update_account(
        self,
        actor: User,
        account_id: UUID,
        payload: AccountUpdate,
        context: RequestContext | None = None,
    ) -> Account:
        """Update an existing account in the actor's tenant."""
        tenant_id = actor.tenant_id
        account = await self.get_account_in_tenant(tenant_id, account_id)

        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return account

        if "name" in update_data and update_data["name"] is not None:
            new_name = update_data["name"].strip()
            if new_name.lower() != account.name.lower():
                existing = await self.repo.get_by_name(tenant_id, new_name)
                if existing and existing.id != account.id:
                    raise ConflictError(f"An account named '{new_name}' already exists.")
            update_data["name"] = new_name

        old_state: dict[str, Any] = {
            "name": account.name,
            "industry": account.industry,
            "size": account.size,
            "website": account.website,
            "address": account.address,
            "owner_id": str(account.owner_id) if account.owner_id else None,
        }

        for key, val in update_data.items():
            if hasattr(account, key):
                setattr(account, key, val)

        await self.session.flush()

        new_state: dict[str, Any] = {
            "name": account.name,
            "industry": account.industry,
            "size": account.size,
            "website": account.website,
            "address": account.address,
            "owner_id": str(account.owner_id) if account.owner_id else None,
        }

        changes = diff(old_state, new_state)
        if changes:
            self.audit.record(
                tenant_id=tenant_id,
                actor=actor,
                context=context,
                action=AuditAction.ACCOUNT_UPDATED,
                entity_type=AuditEntity.ACCOUNT,
                entity_id=account.id,
                summary=f"Updated account '{account.name}'",
                changes=changes,
            )

        return account

    async def delete_account(
        self,
        actor: User,
        account_id: UUID,
        context: RequestContext | None = None,
    ) -> None:
        """Delete an account in the actor's tenant."""
        tenant_id = actor.tenant_id
        account = await self.get_account_in_tenant(tenant_id, account_id)
        account_name = account.name

        deleted = await self.repo.delete(tenant_id, account_id)
        if not deleted:
            raise NotFoundError("Account not found.")

        self.audit.record(
            tenant_id=tenant_id,
            actor=actor,
            context=context,
            action=AuditAction.ACCOUNT_DELETED,
            entity_type=AuditEntity.ACCOUNT,
            entity_id=account_id,
            summary=f"Deleted account '{account_name}'",
            changes=diff({"name": account_name}, {}),
        )
