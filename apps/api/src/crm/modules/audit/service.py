"""Audit recording.

Explicit hooks, not middleware. A middleware can only report "PATCH /users/x
returned 200"; a service hook knows the action was a role change from sales_rep
to admin and can freeze the before/after. Modules therefore call
`AuditService.record(...)` at the point where the business meaning is known.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.modules.audit.models import AuditLog
from crm.modules.audit.repository import AuditRepository
from crm.modules.audit.schemas import AuditLogRead
from crm.modules.users.models import User

#: Never written to the audit trail, whatever a caller diffs.
REDACTED_FIELDS = frozenset({"password", "hashed_password", "token", "refresh_token"})


class RequestContext:
    """Where an action came from, threaded from the router into services."""

    __slots__ = ("ip_address", "request_id", "user_agent")

    def __init__(
        self,
        ip_address: str | None = None,
        user_agent: str | None = None,
        request_id: str | None = None,
    ) -> None:
        self.ip_address = ip_address
        # Long agent strings are stored truncated rather than rejected; losing
        # the tail of a browser string must never fail the action being logged.
        self.user_agent = user_agent[:500] if user_agent else None
        self.request_id = request_id


def diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    """Field-level before/after for the fields that actually changed."""
    changes: dict[str, Any] = {}
    for field, new_value in after.items():
        if field in REDACTED_FIELDS:
            continue
        old_value = before.get(field)
        if old_value != new_value:
            changes[field] = {"before": old_value, "after": new_value}
    return changes


class AuditService:
    """Writes audit entries and reads them back for administrators."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = AuditRepository(session)

    def record(
        self,
        *,
        tenant_id: UUID,
        action: str,
        entity_type: str,
        actor: User | None = None,
        actor_email: str | None = None,
        entity_id: UUID | None = None,
        summary: str = "",
        changes: dict[str, Any] | None = None,
        context: RequestContext | None = None,
    ) -> AuditLog:
        """Stage one entry. The caller's transaction decides whether it sticks.

        `actor_email` covers the case where there is no `User` to point at — a
        failed login names the address that was tried, which is the only thing
        worth recording about an attempt that never authenticated.
        """
        entry = AuditLog(
            tenant_id=tenant_id,
            actor_user_id=actor.id if actor else None,
            actor_email=(actor.email if actor else actor_email) or "system",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary[:500],
            changes=changes or None,
            ip_address=context.ip_address if context else None,
            user_agent=context.user_agent if context else None,
            request_id=context.request_id if context else None,
        )
        return self.repo.add(entry)

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
    ) -> tuple[list[AuditLogRead], int]:
        entries, total = await self.repo.list_entries(
            tenant_id,
            limit=limit,
            offset=offset,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            actor_user_id=actor_user_id,
        )
        return [AuditLogRead.model_validate(entry) for entry in entries], total
