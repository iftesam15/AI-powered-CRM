"""Audit log queries. Insert and read only — no update, no delete."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.modules.audit.models import AuditLog


class AuditRepository:
    """Queries for the append-only audit trail."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, entry: AuditLog) -> AuditLog:
        """Stage an entry on the caller's transaction.

        Deliberately not `async` and deliberately not flushing: an audit row
        belongs to the same transaction as the action it describes, so if the
        action rolls back the record of it does too. The calling service owns
        the commit.
        """
        self.session.add(entry)
        return entry

    async def list_entries(
        self,
        tenant_id: UUID,
        *,
        limit: int,
        offset: int,
        action: str | None = None,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        actor_user_id: UUID | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> tuple[list[AuditLog], int]:
        """Return one page of entries, newest first, plus the unpaged total."""
        conditions: list[ColumnElement[bool]] = [AuditLog.tenant_id == tenant_id]
        if action:
            conditions.append(AuditLog.action == action)
        if entity_type:
            conditions.append(AuditLog.entity_type == entity_type)
        if entity_id:
            conditions.append(AuditLog.entity_id == entity_id)
        if actor_user_id:
            conditions.append(AuditLog.actor_user_id == actor_user_id)
        if since:
            conditions.append(AuditLog.created_at >= since)
        if until:
            conditions.append(AuditLog.created_at <= until)

        rows_stmt = (
            select(AuditLog)
            .where(*conditions)
            # `id` breaks ties: several rows written inside one transaction
            # share a `created_at`, and an unstable order would repeat or skip
            # them across pages.
            .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(rows_stmt)
        entries = list(result.scalars().all())

        count_stmt = select(func.count()).select_from(AuditLog).where(*conditions)
        total = await self.session.scalar(count_stmt) or 0

        return entries, int(total)
