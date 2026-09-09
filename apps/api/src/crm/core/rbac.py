"""Role-Based Access Control (RBAC) permission definitions and mapping.

Permissions follow the `<resource>:<action>` convention and match `apps/web/src/lib/permissions.ts`.
"""

from enum import StrEnum
from typing import Final


class Role(StrEnum):
    ADMIN = "admin"
    SALES_MANAGER = "sales_manager"
    SALES_REP = "sales_rep"
    READ_ONLY = "read_only"


class Permission(StrEnum):
    ACCOUNTS_READ = "accounts:read"
    ACCOUNTS_WRITE = "accounts:write"
    CONTACTS_READ = "contacts:read"
    CONTACTS_WRITE = "contacts:write"
    LEADS_READ = "leads:read"
    LEADS_WRITE = "leads:write"
    OPPORTUNITIES_READ = "opportunities:read"
    OPPORTUNITIES_WRITE = "opportunities:write"
    PIPELINE_READ = "pipeline:read"
    PIPELINE_CONFIGURE = "pipeline:configure"
    ACTIVITIES_READ = "activities:read"
    ACTIVITIES_WRITE = "activities:write"
    TASKS_READ = "tasks:read"
    TASKS_WRITE = "tasks:write"
    SEARCH_READ = "search:read"
    REPORTS_READ = "reports:read"
    IMPORTS_WRITE = "imports:write"
    EXPORTS_READ = "exports:read"
    USERS_READ = "users:read"
    USERS_WRITE = "users:write"
    TENANT_READ = "tenant:read"
    TENANT_WRITE = "tenant:write"
    AUDIT_READ = "audit:read"


READ_ONLY_PERMISSIONS: Final[list[str]] = [
    Permission.ACCOUNTS_READ,
    Permission.CONTACTS_READ,
    Permission.LEADS_READ,
    Permission.OPPORTUNITIES_READ,
    Permission.PIPELINE_READ,
    Permission.ACTIVITIES_READ,
    Permission.TASKS_READ,
    Permission.SEARCH_READ,
    Permission.EXPORTS_READ,
    Permission.REPORTS_READ,
]

SALES_REP_PERMISSIONS: Final[list[str]] = [
    *READ_ONLY_PERMISSIONS,
    Permission.ACCOUNTS_WRITE,
    Permission.CONTACTS_WRITE,
    Permission.LEADS_WRITE,
    Permission.OPPORTUNITIES_WRITE,
    Permission.ACTIVITIES_WRITE,
    Permission.TASKS_WRITE,
    Permission.IMPORTS_WRITE,
]

SALES_MANAGER_PERMISSIONS: Final[list[str]] = [
    *SALES_REP_PERMISSIONS,
    Permission.IMPORTS_WRITE,
    Permission.USERS_READ,
]

ADMIN_PERMISSIONS: Final[list[str]] = [
    *SALES_MANAGER_PERMISSIONS,
    Permission.PIPELINE_CONFIGURE,
    Permission.USERS_WRITE,
    Permission.TENANT_READ,
    Permission.TENANT_WRITE,
    Permission.AUDIT_READ,
]

#: Display names, mirrored in `apps/web/src/lib/permissions.ts`.
ROLE_LABELS: Final[dict[Role, str]] = {
    Role.ADMIN: "Administrator",
    Role.SALES_MANAGER: "Sales manager",
    Role.SALES_REP: "Sales representative",
    Role.READ_ONLY: "Read only",
}

ROLE_PERMISSIONS: Final[dict[str, list[str]]] = {
    Role.READ_ONLY: READ_ONLY_PERMISSIONS,
    Role.SALES_REP: SALES_REP_PERMISSIONS,
    Role.SALES_MANAGER: SALES_MANAGER_PERMISSIONS,
    Role.ADMIN: ADMIN_PERMISSIONS,
}


def get_permissions_for_role(role: str) -> list[str]:
    """Return all permissions granted to a given role."""
    return ROLE_PERMISSIONS.get(role, [])


def role_has_permission(role: str, permission: str) -> bool:
    """Check if a given role grants a specific permission."""
    return permission in get_permissions_for_role(role)
