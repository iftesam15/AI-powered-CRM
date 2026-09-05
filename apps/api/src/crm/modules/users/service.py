"""User lifecycle: create, list, update, role change, activate/deactivate.

Every mutation here records an audit entry on the same transaction, so the
trail cannot drift from what actually happened: if the write rolls back, so
does the record of it.
"""

from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from crm.core.rbac import ROLE_LABELS, Role, get_permissions_for_role
from crm.core.security import hash_password
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext, diff
from crm.modules.users.models import User
from crm.modules.users.repository import DEFAULT_SORT, UserRepository
from crm.modules.users.schemas import RoleRead, UserAdminCreate, UserCreate, UserUpdate


def role_label(role: str) -> str:
    """Human label for a role, falling back to the raw value for old rows."""
    try:
        return ROLE_LABELS[Role(role)]
    except ValueError:
        return role


class UserService:
    """Orchestration for user lifecycle."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = UserRepository(session)
        self.audit = AuditService(session)

    # --- reads ---

    async def get_user(self, user_id: UUID) -> User:
        """Unscoped lookup, for callers that have already established the
        tenant, such as authentication. Admin routes use `get_user_in_tenant`.
        """
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("User not found.")
        return user

    async def get_user_in_tenant(self, tenant_id: UUID, user_id: UUID) -> User:
        """Tenant-scoped lookup.

        A user id belonging to another organisation raises the same error as an
        id that does not exist at all. Distinguishing the two would turn this
        route into an oracle for whether an id is real somewhere else.
        """
        user = await self.repo.get_in_tenant(tenant_id, user_id)
        if not user:
            raise PermissionDeniedError("You do not have access to this user.")
        return user

    async def list_users(
        self,
        tenant_id: UUID,
        *,
        limit: int,
        offset: int,
        search: str | None = None,
        role: str | None = None,
        is_active: bool | None = None,
        sort: str = DEFAULT_SORT,
        descending: bool = False,
    ) -> tuple[list[User], int]:
        return await self.repo.list_in_tenant(
            tenant_id,
            limit=limit,
            offset=offset,
            search=search,
            role=role,
            is_active=is_active,
            sort=sort,
            descending=descending,
        )

    @staticmethod
    def list_roles() -> list[RoleRead]:
        """The role catalogue with the permissions each one grants."""
        return [
            RoleRead(
                value=str(role),
                label=ROLE_LABELS[role],
                permissions=get_permissions_for_role(role),
            )
            for role in Role
        ]

    # --- writes ---

    async def create_user(self, data: UserCreate) -> User:
        """Create a user directly. Used by the seed and bootstrap scripts."""
        existing = await self.repo.get_by_email_and_tenant(data.email, data.tenant_id)
        if existing:
            raise ConflictError(
                f"User with email '{data.email}' already exists in this tenant."
            )

        user = User(
            tenant_id=data.tenant_id,
            email=data.email.lower().strip(),
            hashed_password=hash_password(data.password),
            full_name=data.full_name.strip(),
            role=str(data.role),
            is_active=data.is_active,
            failed_login_attempts=0,
        )
        return await self.repo.create(user)

    async def create_user_as_admin(
        self,
        actor: User,
        data: UserAdminCreate,
        context: RequestContext | None = None,
    ) -> User:
        """Create a user in the actor's tenant and record it.

        The tenant comes from `actor`, never from the request body.
        """
        user = await self.create_user(
            UserCreate(
                tenant_id=actor.tenant_id,
                email=data.email,
                full_name=data.full_name,
                role=data.role,
                is_active=data.is_active,
                password=data.password,
            )
        )

        self.audit.record(
            tenant_id=actor.tenant_id,
            actor=actor,
            action=AuditAction.USER_CREATED,
            entity_type=AuditEntity.USER,
            entity_id=user.id,
            summary=(
                f"Created {user.full_name} ({user.email}) "
                f"as {role_label(user.role)}"
            ),
            changes={
                "email": {"before": None, "after": user.email},
                "full_name": {"before": None, "after": user.full_name},
                "role": {"before": None, "after": user.role},
                "is_active": {"before": None, "after": user.is_active},
            },
            context=context,
        )

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def update_user(
        self,
        actor: User,
        user_id: UUID,
        data: UserUpdate,
        context: RequestContext | None = None,
    ) -> User:
        """Apply a partial update, enforcing the deactivation and admin guards."""
        user = await self.get_user_in_tenant(actor.tenant_id, user_id)
        patch = data.model_dump(exclude_unset=True)
        if not patch:
            return user

        # Roles arrive as the enum; store and diff the plain string the column
        # actually holds, or every update would look like a role change.
        if patch.get("role") is not None:
            patch["role"] = str(patch["role"])

        self._guard_self_deactivation(actor, user, patch)
        await self._guard_last_admin(user, patch)

        before: dict[str, Any] = {
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
        }

        for field, value in patch.items():
            setattr(user, field, value)

        after: dict[str, Any] = {
            "full_name": user.full_name,
            "role": user.role,
            "is_active": user.is_active,
        }
        changes = diff(before, after)
        if not changes:
            return user

        # Reactivating clears a lockout. An administrator switching an account
        # back on means it to be usable now, not in fifteen minutes.
        if changes.get("is_active", {}).get("after") is True:
            user.failed_login_attempts = 0
            user.locked_until = None

        for action, summary in self._actions_for(user, changes):
            self.audit.record(
                tenant_id=actor.tenant_id,
                actor=actor,
                action=action,
                entity_type=AuditEntity.USER,
                entity_id=user.id,
                summary=summary,
                changes=changes,
                context=context,
            )

        await self.session.commit()
        await self.session.refresh(user)
        return user

    # --- guards ---

    @staticmethod
    def _guard_self_deactivation(actor: User, target: User, patch: dict[str, Any]) -> None:
        """Nobody switches off the account they are currently signed in with.

        Every other self-edit is allowed and merely takes effect on the next
        request — an admin stepping down to sales manager is a legitimate thing
        to do, and `_guard_last_admin` is what stops it stranding the tenant.
        """
        if actor.id == target.id and patch.get("is_active") is False:
            raise ConflictError(
                "You cannot deactivate your own account. "
                "Ask another administrator to do it."
            )

    async def _guard_last_admin(self, target: User, patch: dict[str, Any]) -> None:
        """Keep at least one active administrator in every tenant.

        The count includes the target, so this is what actually catches the
        sole administrator demoting themselves — the case that would otherwise
        leave an organisation with nobody able to manage its users.
        """
        if target.role != Role.ADMIN or not target.is_active:
            return

        losing_admin = ("role" in patch and patch["role"] != Role.ADMIN) or (
            patch.get("is_active") is False
        )
        if not losing_admin:
            return

        remaining = await self.repo.count_active_with_role(
            target.tenant_id, str(Role.ADMIN)
        )
        if remaining <= 1:
            raise ConflictError(
                "This is the last active administrator. "
                "Promote another user to administrator first."
            )

    @staticmethod
    def _actions_for(user: User, changes: dict[str, Any]) -> list[tuple[str, str]]:
        """Turn a field diff into the audit actions worth naming separately.

        A role change and a deactivation are what an auditor actually searches
        for, so they get their own action names rather than being buried inside
        a generic `user.updated`.
        """
        entries: list[tuple[str, str]] = []
        who = f"{user.full_name} ({user.email})"

        if "role" in changes:
            before = role_label(str(changes["role"]["before"]))
            after = role_label(str(changes["role"]["after"]))
            entries.append(
                (
                    str(AuditAction.USER_ROLE_CHANGED),
                    f"Changed role of {who} from {before} to {after}",
                )
            )

        if "is_active" in changes:
            activated = changes["is_active"]["after"] is True
            action = (
                AuditAction.USER_ACTIVATED if activated else AuditAction.USER_DEACTIVATED
            )
            verb = "Activated" if activated else "Deactivated"
            entries.append((str(action), f"{verb} {who}"))

        # Only fall back to the generic action when nothing more specific fired,
        # so a single edit never produces two rows saying the same thing.
        if not entries:
            entries.append((str(AuditAction.USER_UPDATED), f"Updated {who}"))

        return entries
