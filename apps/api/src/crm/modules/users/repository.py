"""User database queries.

Two families of method here, and the difference matters. `get_by_id` and
`get_by_email` are unscoped because authentication has to find a user *before*
a tenant is known. Everything the admin surface calls takes `tenant_id` and is
scoped, so a user id from another organisation simply does not resolve.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from crm.modules.users.models import User

#: Sortable columns, allow-listed. Accepting a raw column name from the query
#: string would let a caller order by anything on the table, including
#: `hashed_password` — which leaks its ordering, one request at a time.
SORTABLE_FIELDS: dict[str, InstrumentedAttribute[Any]] = {
    "full_name": User.full_name,
    "email": User.email,
    "role": User.role,
    "created_at": User.created_at,
    "last_login_at": User.last_login_at,
}
DEFAULT_SORT = "full_name"


class UserRepository:
    """Queries for user models."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # --- unscoped: used by authentication, before a tenant is known ---

    async def get_by_id(self, user_id: UUID) -> User | None:
        stmt = select(User).where(User.id == user_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> list[User]:
        """Find users by email (case-insensitive search)."""
        stmt = select(User).where(User.email.ilike(email))
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_email_and_tenant(self, email: str, tenant_id: UUID) -> User | None:
        stmt = select(User).where(User.email.ilike(email), User.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        return user

    # --- tenant-scoped: used by the admin surface ---

    async def get_in_tenant(self, tenant_id: UUID, user_id: UUID) -> User | None:
        stmt = select(User).where(User.id == user_id, User.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_in_tenant(
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
        """Return one page of the tenant's users plus the unpaged total."""
        conditions: list[ColumnElement[bool]] = [User.tenant_id == tenant_id]

        if search:
            needle = f"%{search.strip()}%"
            conditions.append(or_(User.full_name.ilike(needle), User.email.ilike(needle)))
        if role:
            conditions.append(User.role == role)
        if is_active is not None:
            conditions.append(User.is_active.is_(is_active))

        column = SORTABLE_FIELDS.get(sort, SORTABLE_FIELDS[DEFAULT_SORT])
        order = column.desc() if descending else column.asc()

        rows_stmt = (
            select(User)
            .where(*conditions)
            .order_by(order, User.id.asc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(rows_stmt)
        users = list(result.scalars().all())

        count_stmt = select(func.count()).select_from(User).where(*conditions)
        total = await self.session.scalar(count_stmt) or 0

        return users, int(total)

    async def count_active_with_role(self, tenant_id: UUID, role: str) -> int:
        """How many active users hold a role. Guards the last-admin rule."""
        stmt = (
            select(func.count())
            .select_from(User)
            .where(
                User.tenant_id == tenant_id,
                User.role == role,
                User.is_active.is_(True),
            )
        )
        return int(await self.session.scalar(stmt) or 0)
