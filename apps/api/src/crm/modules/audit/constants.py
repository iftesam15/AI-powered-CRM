"""Audit action names.

One flat, stable vocabulary of `<entity>.<verb past tense>` strings. They are
written to the database and rendered in the settings UI, so renaming one
rewrites history: add a new action instead.
"""

from enum import StrEnum


class AuditAction(StrEnum):
    # Authentication
    LOGIN_SUCCEEDED = "auth.login_succeeded"
    LOGIN_FAILED = "auth.login_failed"
    ACCOUNT_LOCKED = "auth.account_locked"
    LOGGED_OUT = "auth.logged_out"
    PASSWORD_RESET_REQUESTED = "auth.password_reset_requested"
    PASSWORD_RESET_COMPLETED = "auth.password_reset_completed"

    # User administration
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"
    USER_ROLE_CHANGED = "user.role_changed"
    USER_ACTIVATED = "user.activated"
    USER_DEACTIVATED = "user.deactivated"

    # Account administration
    ACCOUNT_CREATED = "account.created"
    ACCOUNT_UPDATED = "account.updated"
    ACCOUNT_DELETED = "account.deleted"


class AuditEntity(StrEnum):
    USER = "user"
    TENANT = "tenant"
    ACCOUNT = "account"
    CONTACT = "contact"
    LEAD = "lead"
    OPPORTUNITY = "opportunity"


#: Actions an administrator most often filters by, surfaced in the UI dropdown.
SECURITY_ACTIONS: tuple[str, ...] = (
    AuditAction.LOGIN_FAILED,
    AuditAction.ACCOUNT_LOCKED,
    AuditAction.USER_ROLE_CHANGED,
    AuditAction.USER_DEACTIVATED,
)
