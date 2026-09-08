"""Activity service layer."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import PermissionDeniedError
from crm.modules.accounts.repository import AccountRepository
from crm.modules.activities.models import Activity
from crm.modules.activities.repository import ActivityRepository
from crm.modules.activities.schemas import ActivityCreate, ActivityRead, TimelineItemRead
from crm.modules.audit.service import AuditService
from crm.modules.contacts.repository import ContactRepository
from crm.modules.users.models import User


class ActivityService:
    """Business logic for activities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ActivityRepository(session)
        self.account_repo = AccountRepository(session)
        self.contact_repo = ContactRepository(session)
        self.audit_service = AuditService(session)

    async def create_activity(self, data: ActivityCreate, current_user: User) -> ActivityRead:
        tenant_id = current_user.tenant_id

        # Validate entity target existence and tenant isolation
        account_id = data.account_id
        contact_id = data.contact_id

        if data.entity_type == "account":
            account = await self.account_repo.get_by_id(tenant_id, data.entity_id)
            if not account:
                raise PermissionDeniedError("Target account does not exist or belongs to another organization.")
            account_id = account.id
        elif data.entity_type == "contact":
            contact = await self.contact_repo.get_by_id(tenant_id, data.entity_id)
            if not contact:
                raise PermissionDeniedError("Target contact does not exist or belongs to another organization.")
            contact_id = contact.id
            if not account_id and contact.account_id:
                account_id = contact.account_id

        # Validate direct account_id if explicitly passed
        if data.account_id:
            account = await self.account_repo.get_by_id(tenant_id, data.account_id)
            if not account:
                raise PermissionDeniedError("Target account does not exist or belongs to another organization.")

        # Validate direct contact_id if explicitly passed
        if data.contact_id:
            contact = await self.contact_repo.get_by_id(tenant_id, data.contact_id)
            if not contact:
                raise PermissionDeniedError("Target contact does not exist or belongs to another organization.")

        performed_at = data.performed_at or datetime.now(timezone.utc)

        activity = await self.repo.create(
            tenant_id=tenant_id,
            activity_type=data.activity_type.value,
            title=data.title,
            description=data.description,
            performed_at=performed_at,
            entity_type=data.entity_type.value,
            entity_id=data.entity_id,
            account_id=account_id,
            contact_id=contact_id,
            created_by_id=current_user.id,
        )

        self.audit_service.record(
            tenant_id=tenant_id,
            action="activity.created",
            entity_type="activity",
            entity_id=activity.id,
            actor=current_user,
            summary=f"Logged activity '{activity.title}' ({activity.activity_type})",
        )

        return self._to_dto(activity)

    async def get_activity(self, activity_id: uuid.UUID, current_user: User) -> ActivityRead:
        activity = await self.repo.get_by_id(current_user.tenant_id, activity_id)
        if not activity:
            raise PermissionDeniedError("Activity does not exist or belongs to another organization.")
        return self._to_dto(activity)

    async def list_activities(
        self,
        current_user: User,
        activity_type: str | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[ActivityRead], int]:
        activities, total = await self.repo.list_activities(
            tenant_id=current_user.tenant_id,
            activity_type=activity_type,
            entity_type=entity_type,
            entity_id=entity_id,
            limit=limit,
            offset=offset,
        )
        return [self._to_dto(a) for a in activities], total

    async def delete_activity(self, activity_id: uuid.UUID, current_user: User) -> None:
        activity = await self.repo.get_by_id(current_user.tenant_id, activity_id)
        if not activity:
            raise PermissionDeniedError("Activity does not exist or belongs to another organization.")

        title = activity.title
        deleted = await self.repo.delete(current_user.tenant_id, activity_id)
        if deleted:
            self.audit_service.record(
                tenant_id=current_user.tenant_id,
                action="activity.deleted",
                entity_type="activity",
                entity_id=activity_id,
                actor=current_user,
                summary=f"Deleted activity '{title}'",
            )

    async def get_timeline(
        self,
        entity_type: str,
        entity_id: uuid.UUID,
        current_user: User,
        limit: int = 50,
    ) -> list[TimelineItemRead]:
        tenant_id = current_user.tenant_id

        # Tenant isolation check for the target entity
        if entity_type == "account":
            account = await self.account_repo.get_by_id(tenant_id, entity_id)
            if not account:
                raise PermissionDeniedError("Target account does not exist or belongs to another organization.")
        elif entity_type == "contact":
            contact = await self.contact_repo.get_by_id(tenant_id, entity_id)
            if not contact:
                raise PermissionDeniedError("Target contact does not exist or belongs to another organization.")

        items = await self.repo.get_timeline(tenant_id, entity_type, entity_id, limit=limit)
        return [TimelineItemRead(**item) for item in items]

    def _to_dto(self, activity: Activity) -> ActivityRead:
        account_name = activity.account.name if activity.account else None
        contact_name = (
            f"{activity.contact.first_name} {activity.contact.last_name}"
            if activity.contact
            else None
        )
        created_by_name = activity.created_by.full_name if activity.created_by else None

        return ActivityRead(
            id=activity.id,
            tenant_id=activity.tenant_id,
            activity_type=activity.activity_type,
            title=activity.title,
            description=activity.description,
            performed_at=activity.performed_at,
            entity_type=activity.entity_type,
            entity_id=activity.entity_id,
            account_id=activity.account_id,
            contact_id=activity.contact_id,
            created_by_id=activity.created_by_id,
            account_name=account_name,
            contact_name=contact_name,
            created_by_name=created_by_name,
            created_at=activity.created_at,
            updated_at=activity.updated_at,
        )
