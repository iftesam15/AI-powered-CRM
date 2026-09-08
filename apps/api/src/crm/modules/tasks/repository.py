"""Task repository for database queries."""

import uuid
from datetime import datetime

from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from crm.modules.tasks.models import Task


class TaskRepository:
    """Async repository for tenant-scoped Task entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        tenant_id: uuid.UUID,
        title: str,
        description: str | None,
        status: str,
        priority: str,
        due_date: datetime | None,
        completed_at: datetime | None,
        entity_type: str | None,
        entity_id: uuid.UUID | None,
        account_id: uuid.UUID | None,
        contact_id: uuid.UUID | None,
        assigned_to_id: uuid.UUID | None,
        created_by_id: uuid.UUID | None,
    ) -> Task:
        task = Task(
            tenant_id=tenant_id,
            title=title,
            description=description,
            status=status,
            priority=priority,
            due_date=due_date,
            completed_at=completed_at,
            entity_type=entity_type,
            entity_id=entity_id,
            account_id=account_id,
            contact_id=contact_id,
            assigned_to_id=assigned_to_id,
            created_by_id=created_by_id,
        )
        self.session.add(task)
        await self.session.commit()
        await self.session.refresh(task)
        return task

    async def get_by_id(self, tenant_id: uuid.UUID, task_id: uuid.UUID) -> Task | None:
        stmt = select(Task).where(
            Task.tenant_id == tenant_id,
            Task.id == task_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_tasks(
        self,
        tenant_id: uuid.UUID,
        status_filter: str | None = None,
        priority_filter: str | None = None,
        assigned_to_id: uuid.UUID | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Task], int]:
        stmt = select(Task).where(Task.tenant_id == tenant_id)

        if status_filter:
            stmt = stmt.where(Task.status == status_filter)
        if priority_filter:
            stmt = stmt.where(Task.priority == priority_filter)
        if assigned_to_id:
            stmt = stmt.where(Task.assigned_to_id == assigned_to_id)
        if entity_type:
            stmt = stmt.where(Task.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(
                or_(
                    Task.entity_id == entity_id,
                    Task.account_id == entity_id,
                    Task.contact_id == entity_id,
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(desc(Task.created_at)).offset(offset).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def update(self, task: Task) -> Task:
        await self.session.commit()
        await self.session.refresh(task)
        return task

    async def delete(self, tenant_id: uuid.UUID, task_id: uuid.UUID) -> bool:
        task = await self.get_by_id(tenant_id, task_id)
        if not task:
            return False
        await self.session.delete(task)
        await self.session.commit()
        return True
