"""User Pydantic validation schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from crm.core.rbac import Role

EMAIL_PATTERN = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
MIN_PASSWORD_LENGTH = 8


class UserBase(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    full_name: str = Field(min_length=1, max_length=255)
    role: Role = Role.SALES_REP
    is_active: bool = True


class UserCreate(UserBase):
    """Internal creation shape. `tenant_id` is set by the caller, never parsed
    from a request body — see `UserAdminCreate`."""

    password: str = Field(min_length=MIN_PASSWORD_LENGTH)
    tenant_id: UUID


class UserAdminCreate(BaseModel):
    """What an administrator may send to `POST /users`.

    There is no `tenant_id` field, and that omission is the security property:
    the new user lands in the caller's tenant because the server reads it from
    the session. A body-supplied tenant would let an admin plant an account in
    somebody else's organisation.
    """

    email: str = Field(min_length=3, max_length=255, pattern=EMAIL_PATTERN)
    full_name: str = Field(min_length=1, max_length=255)
    role: Role = Role.SALES_REP
    is_active: bool = True
    password: str = Field(
        min_length=MIN_PASSWORD_LENGTH,
        description="Initial password. The user should change it after signing in.",
    )


class UserUpdate(BaseModel):
    """Partial update. Every field optional; only what is sent is changed.

    Email is not updatable here. Changing the address someone signs in with is
    an identity change and needs a verification round-trip, which no sprint has
    built yet — better absent than half-done.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: Role | None = None
    is_active: bool | None = None

    @field_validator("full_name")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    last_login_at: datetime | None
    #: True while a lockout from repeated failed logins is still in force.
    is_locked: bool = False
    created_at: datetime
    updated_at: datetime


class RoleRead(BaseModel):
    """A role and everything it grants, for the admin UI's role picker."""

    value: str
    label: str
    permissions: list[str]
