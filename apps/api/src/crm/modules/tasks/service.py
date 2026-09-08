"""Task service layer."""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import PermissionDeniedError
from crm.modules.accounts.repository import AccountRepository
from crm.modules.audit.service import AuditService
from crm.modules.contacts.repository import ContactRepository
from crm.modules.tasks.models import Task
from crm.modules.tasks.repository import TaskRepository
from crm.modules.tasks.schemas import TaskCreate, TaskRead, TaskUpdate
from crm.modules.users.models import User
from crm.modules.users.repository import UserRepository


class TaskService:
    """Business logic for tasks."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TaskRepository(session)
        self.account_repo = AccountRepository(session)
        self.contact_repo = ContactRepository(session)
        self.user_repo = UserRepository(session)
        self.audit_service = AuditService(session)

    async def create_task(self, data: TaskCreate, current_user: User) -> TaskRead:
        tenant_id = current_user.tenant_id

        # Validate entity target existence and tenant isolation if supplied
        account_id = data.account_id
        contact_id = data.contact_id
        entity_type = data.entity_type
        entity_id = data.entity_id

        if entity_type == "account" and entity_id:
            account = await self.account_repo.get_by_id(tenant_id, entity_id)
            if not account:
                raise PermissionDeniedError("Target account does not exist or belongs to another organization.")
            account_id = account.id
        elif entity_type == "contact" and entity_id:
            contact = await self.contact_repo.get_by_id(tenant_id, entity_id)
            if not contact:
                raise PermissionDeniedError("Target contact does not exist or belongs to another organization.")
            contact_id = contact.id
            if not account_id and contact.account_id:
                account_id = contact.account_id

        # Validate direct account_id if passed
        if data.account_id:
            account = await self.account_repo.get_by_id(tenant_id, data.account_id)
            if not account:
                raise PermissionDeniedError("Target account does not exist or belongs to another organization.")

        # Validate direct contact_id if passed
        if data.contact_id:
            contact = await self.contact_repo.get_by_id(tenant_id, data.contact_id)
            if not contact:
                raise PermissionDeniedError("Target contact does not exist or belongs to another organization.")

        # Validate assigned user in tenant
        assigned_to_id = data.assigned_to_id or current_user.id
        if data.assigned_to_id:
            assigned_user = await self.user_repo.get_by_id(data.assigned_to_id)
            if not assigned_user or assigned_user.tenant_id != tenant_id:
                raise PermissionDeniedError("Assigned user does not exist or belongs to another organization.")

        completed_at = datetime.now(timezone.utc) if data.status == "completed" else None

        task = await self.repo.create(
            tenant_id=tenant_id,
            title=data.title,
            description=data.description,
            status=data.status.value,
            priority=data.priority.value,
            due_date=data.due_date,
            completed_at=completed_at,
            entity_type=entity_type,
            entity_id=entity_id,
            account_id=account_id,
            contact_id=contact_id,
            assigned_to_id=assigned_to_id,
            created_by_id=current_user.id,
        )

        self.audit_service.record(
            tenant_id=tenant_id,
            action="task.created",
            entity_type="task",
            entity_id=task.id,
            actor=current_user,
            summary=f"Created task '{task.title}'",
        )

        return self._to_dto(task)

    async def get_task(self, task_id: uuid.UUID, current_user: User) -> TaskRead:
        task = await self.repo.get_by_id(current_user.tenant_id, task_id)
        if not task:
            raise PermissionDeniedError("Task does not exist or belongs to another organization.")
        return self._to_dto(task)

    async def list_tasks(
        self,
        current_user: User,
        status_filter: str | None = None,
        priority_filter: str | None = None,
        assigned_to_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[TaskRead], int]:
        tasks, total = await self.repo.list_tasks(
            tenant_id=current_user.tenant_id,
            status_filter=status_filter,
            priority_filter=priority_filter,
            assigned_to_id=assigned_to_id,
            entity_type=entity_type,
            entity_id=entity_id,
            limit=limit,
            offset=offset,
        )
        return [self._to_dto(t) for t in tasks], total

    async def update_task(
        self, task_id: uuid.UUID, data: TaskUpdate, current_user: User
    ) -> TaskRead:
        tenant_id = current_user.tenant_id
        task = await self.repo.get_by_id(tenant_id, task_id)
        if not task:
            raise PermissionDeniedError("Task does not exist or belongs to another organization.")

        if data.assigned_to_id:
            assigned_user = await self.user_repo.get_by_id(data.assigned_to_id)
            if not assigned_user or assigned_user.tenant_id != tenant_id:
                raise PermissionDeniedError("Assigned user does not exist or belongs to another organization.")
            task.assigned_to_id = data.assigned_to_id

        if data.title is not None:
            task.title = data.title
        if data.description is not None:
            task.description = data.description
        if data.priority is not None:
            task.priority = data.priority.value
        if data.due_date is not None:
            task.due_date = data.due_date

        if data.status is not None:
            old_status = task.status
            new_status = data.status.value
            task.status = new_status
            if new_status == "completed" and old_status != "completed":
                task.completed_at = datetime.now(timezone.utc)
            elif new_status != "completed":
                task.completed_at = None

        updated_task = await self.repo.update(task)

        self.audit_service.record(
            tenant_id=tenant_id,
            action="task.updated",
            entity_type="task",
            entity_id=task.id,
            actor=current_user,
            summary=f"Updated task '{task.title}'",
        )

        return self._to_dto(updated_task)

    async def delete_task(self, task_id: uuid.UUID, current_user: User) -> None:
        task = await self.repo.get_by_id(current_user.tenant_id, task_id)
        if not task:
            raise PermissionDeniedError("Task does not exist or belongs to another organization.")

        title = task.title
        deleted = await self.repo.delete(current_user.tenant_id, task_id)
        if deleted:
            self.audit_service.record(
                tenant_id=current_user.tenant_id,
                action="task.deleted",
                entity_type="task",
                entity_id=task_id,
                actor=current_user,
                summary=f"Deleted task '{title}'",
            )

    def _to_dto(self, task: Task) -> TaskRead:
        account_name = task.account.name if task.account else None
        contact_name = (
            f"{task.contact.first_name} {task.contact.last_name}" if task.contact else None
        )
        assigned_to_name = task.assigned_to.full_name if task.assigned_to else None
        created_by_name = task.created_by.full_name if task.created_by else None

        return TaskRead(
            id=task.id,
            tenant_id=task.tenant_id,
            title=task.title,
            description=task.description,
            status=task.status,  # type: ignore
            priority=task.priority,  # type: ignore
            due_date=task.due_date,
            completed_at=task.completed_at,
            entity_type=task.entity_type,
            entity_id=task.entity_id,
            account_id=task.account_id,
            contact_id=task.contact_id,
            assigned_to_id=task.assigned_to_id,
            created_by_id=task.created_by_id,
            account_name=account_name,
            contact_name=contact_name,
            assigned_to_name=assigned_to_name,
            created_by_name=created_by_name,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
