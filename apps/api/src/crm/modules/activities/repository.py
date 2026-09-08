"""Activity repository for database queries."""

import uuid
from datetime import datetime

from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from crm.modules.activities.models import Activity
from crm.modules.tasks.models import Task


class ActivityRepository:
    """Async repository for tenant-scoped Activity entities."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        tenant_id: uuid.UUID,
        activity_type: str,
        title: str,
        description: str | None,
        performed_at: datetime,
        entity_type: str,
        entity_id: uuid.UUID,
        account_id: uuid.UUID | None,
        contact_id: uuid.UUID | None,
        created_by_id: uuid.UUID | None,
    ) -> Activity:
        activity = Activity(
            tenant_id=tenant_id,
            activity_type=activity_type,
            title=title,
            description=description,
            performed_at=performed_at,
            entity_type=entity_type,
            entity_id=entity_id,
            account_id=account_id,
            contact_id=contact_id,
            created_by_id=created_by_id,
        )
        self.session.add(activity)
        await self.session.commit()
        await self.session.refresh(activity)
        return activity

    async def get_by_id(self, tenant_id: uuid.UUID, activity_id: uuid.UUID) -> Activity | None:
        stmt = select(Activity).where(
            Activity.tenant_id == tenant_id,
            Activity.id == activity_id,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_activities(
        self,
        tenant_id: uuid.UUID,
        activity_type: str | None = None,
        entity_type: str | None = None,
        entity_id: uuid.UUID | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Activity], int]:
        stmt = select(Activity).where(Activity.tenant_id == tenant_id)

        if activity_type:
            stmt = stmt.where(Activity.activity_type == activity_type)
        if entity_type:
            stmt = stmt.where(Activity.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(
                or_(
                    Activity.entity_id == entity_id,
                    Activity.account_id == entity_id,
                    Activity.contact_id == entity_id,
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_res = await self.session.execute(count_stmt)
        total = total_res.scalar_one()

        stmt = stmt.order_by(desc(Activity.performed_at)).offset(offset).limit(limit)
        res = await self.session.execute(stmt)
        return list(res.scalars().all()), total

    async def delete(self, tenant_id: uuid.UUID, activity_id: uuid.UUID) -> bool:
        activity = await self.get_by_id(tenant_id, activity_id)
        if not activity:
            return False
        await self.session.delete(activity)
        await self.session.commit()
        return True

    async def get_timeline(
        self,
        tenant_id: uuid.UUID,
        entity_type: str,
        entity_id: uuid.UUID,
        limit: int = 50,
    ) -> list[dict]:
        """Fetch combined chronological timeline of activities and tasks for an entity."""
        # Query activities for entity
        act_stmt = select(Activity).where(
            Activity.tenant_id == tenant_id,
            or_(
                Activity.entity_id == entity_id,
                Activity.account_id == entity_id,
                Activity.contact_id == entity_id,
            ),
        ).order_by(desc(Activity.performed_at)).limit(limit)

        act_res = await self.session.execute(act_stmt)
        activities = list(act_res.scalars().all())

        # Query tasks for entity
        task_stmt = select(Task).where(
            Task.tenant_id == tenant_id,
            or_(
                Task.entity_id == entity_id,
                Task.account_id == entity_id,
                Task.contact_id == entity_id,
            ),
        ).order_by(desc(Task.created_at)).limit(limit)

        task_res = await self.session.execute(task_stmt)
        tasks = list(task_res.scalars().all())

        timeline_items = []

        for act in activities:
            creator_name = act.created_by.full_name if act.created_by else None
            timeline_items.append({
                "id": act.id,
                "item_type": "activity",
                "category": act.activity_type,
                "title": act.title,
                "description": act.description,
                "timestamp": act.performed_at,
                "status": None,
                "priority": None,
                "due_date": None,
                "entity_type": act.entity_type,
                "entity_id": act.entity_id,
                "actor_name": creator_name,
                "raw_id": act.id,
            })

        for tsk in tasks:
            assignee_name = tsk.assigned_to.full_name if tsk.assigned_to else None
            timestamp = tsk.completed_at or tsk.created_at
            timeline_items.append({
                "id": tsk.id,
                "item_type": "task",
                "category": "task_completed" if tsk.status == "completed" else "task",
                "title": tsk.title,
                "description": tsk.description,
                "timestamp": timestamp,
                "status": tsk.status,
                "priority": tsk.priority,
                "due_date": tsk.due_date,
                "entity_type": tsk.entity_type,
                "entity_id": tsk.entity_id,
                "actor_name": assignee_name,
                "raw_id": tsk.id,
            })

        # Sort all items descending by timestamp
        timeline_items.sort(key=lambda x: x["timestamp"], reverse=True)
        return timeline_items[:limit]
