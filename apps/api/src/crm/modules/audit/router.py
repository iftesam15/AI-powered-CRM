"""Audit log HTTP router. Read-only by design."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import get_current_tenant, require_permission
from crm.core.pagination import Page, PageParamsDep
from crm.core.rbac import Permission
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.schemas import AuditLogRead
from crm.modules.audit.service import AuditService
from crm.modules.tenants.models import Tenant
from crm.modules.users.models import User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get(
    "",
    response_model=Page[AuditLogRead],
    summary="List audit entries",
)
async def list_audit_entries(
    _: Annotated[User, Depends(require_permission(Permission.AUDIT_READ))],
    tenant: Annotated[Tenant, Depends(get_current_tenant)],
    session: Annotated[AsyncSession, Depends(get_db)],
    page: PageParamsDep,
    action: Annotated[str | None, Query(description="Exact action name.")] = None,
    entity_type: Annotated[str | None, Query(description="Entity kind.")] = None,
    entity_id: Annotated[UUID | None, Query(description="Single record's trail.")] = None,
    actor_user_id: Annotated[UUID | None, Query(description="Who performed it.")] = None,
) -> Page[AuditLogRead]:
    """Newest first, scoped to the caller's tenant. Requires `audit:read`."""
    service = AuditService(session)
    entries, total = await service.list_entries(
        tenant.id,
        limit=page.limit,
        offset=page.offset,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
    )
    return Page.of(entries, total, page)


@router.get(
    "/actions",
    response_model=list[str],
    summary="List recordable audit actions",
)
async def list_audit_actions(
    _: Annotated[User, Depends(require_permission(Permission.AUDIT_READ))],
) -> list[str]:
    """Vocabulary for the filter dropdown, so the web app hardcodes nothing."""
    return sorted(AuditAction)


@router.get(
    "/entity-types",
    response_model=list[str],
    summary="List auditable entity types",
)
async def list_audit_entity_types(
    _: Annotated[User, Depends(require_permission(Permission.AUDIT_READ))],
) -> list[str]:
    return sorted(AuditEntity)
