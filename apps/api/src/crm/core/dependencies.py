"""FastAPI authentication, tenant, and RBAC dependencies."""

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.config import settings
from crm.core.database import get_db
from crm.core.exceptions import AuthenticationError, PermissionDeniedError
from crm.core.rbac import role_has_permission
from crm.core.security import decode_jwt_token
from crm.modules.audit.service import RequestContext
from crm.modules.tenants.models import Tenant
from crm.modules.tenants.repository import TenantRepository
from crm.modules.users.models import User
from crm.modules.users.repository import UserRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.api_v1_prefix}/auth/login",
    auto_error=False,
)


async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """Extract and validate bearer token, returning the authenticated user."""
    if not token:
        raise AuthenticationError("Not authenticated.")

    payload = decode_jwt_token(token)
    if payload.get("type") != "access":
        raise AuthenticationError("Invalid token type.")

    sub = payload.get("sub")
    if not sub:
        raise AuthenticationError("Invalid token subject.")

    try:
        user_id = UUID(str(sub))
    except ValueError as exc:
        raise AuthenticationError("Malformed user identifier.") from exc

    user_repo = UserRepository(session)
    user = await user_repo.get_by_id(user_id)
    if not user or not user.is_active:
        raise AuthenticationError("Account is inactive or does not exist.")

    return user


async def get_current_tenant(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Tenant:
    """Resolve and validate the tenant associated with the authenticated user."""
    tenant_repo = TenantRepository(session)
    tenant = await tenant_repo.get_by_id(user.tenant_id)
    if not tenant or not tenant.is_active:
        raise PermissionDeniedError("Organization account is inactive.")

    return tenant


def require_permission(permission: str) -> Callable[[User], User]:
    """Dependency factory checking if the user's role has the required permission."""

    def _dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if not role_has_permission(user.role, permission):
            raise PermissionDeniedError(f"Permission '{permission}' is required.")
        return user

    return _dependency


def require_role(*roles: str) -> Callable[[User], User]:
    """Dependency factory checking if the user has one of the allowed roles."""

    def _dependency(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise PermissionDeniedError("Insufficient role for this action.")
        return user

    return _dependency


def get_request_context(request: Request) -> RequestContext:
    """Where the current call came from, for the audit trail.

    The web app reaches the API through its own server-side proxy, so
    `request.client.host` is the proxy, not the browser. `x-forwarded-for` is
    read first and only its left-most entry is kept — the rest of the chain is
    appended by hops we do not control and is not evidence of anything.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip_address: str | None = forwarded.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else None

    return RequestContext(
        ip_address=ip_address,
        user_agent=request.headers.get("user-agent"),
        request_id=getattr(request.state, "request_id", None),
    )


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentTenant = Annotated[Tenant, Depends(get_current_tenant)]
RequestContextDep = Annotated[RequestContext, Depends(get_request_context)]
