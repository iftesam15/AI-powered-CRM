"""Authentication business service."""

import logging
import math
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.config import settings
from crm.core.exceptions import (
    AccountInactiveError,
    AccountLockedError,
    AuthenticationError,
    InvalidTokenError,
    TokenAlreadyUsedError,
    TokenExpiredError,
)
from crm.core.security import (
    create_access_token,
    create_refresh_token,
    decode_jwt_token,
    generate_reset_token,
    hash_password,
    hash_token,
    verify_password,
)
from crm.integrations.mail.protocol import MailSender
from crm.modules.audit.constants import AuditAction, AuditEntity
from crm.modules.audit.service import AuditService, RequestContext
from crm.modules.auth.repository import AuthRepository
from crm.modules.tenants.repository import TenantRepository
from crm.modules.users.repository import UserRepository

logger = logging.getLogger(__name__)


def ensure_utc(dt: datetime | None) -> datetime | None:
    """Ensure a datetime object is timezone-aware in UTC (SQLite compatibility)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


class AuthService:
    """Orchestration for authentication, lockout, token issuance, and password reset."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.auth_repo = AuthRepository(session)
        self.user_repo = UserRepository(session)
        self.tenant_repo = TenantRepository(session)
        self.audit = AuditService(session)

    async def login(
        self,
        email: str,
        password: str,
        context: RequestContext | None = None,
    ) -> tuple[str, str]:
        """Authenticate user by email and password with brute-force lockout protection."""
        users = await self.user_repo.get_by_email(email)
        if not users:
            raise AuthenticationError("Email or password is incorrect.")

        # In multi-tenant with unique email per tenant, pick the matching active account
        user = users[0]
        now = datetime.now(UTC)

        # Check account lockout
        locked_until_utc = ensure_utc(user.locked_until)
        if locked_until_utc is not None:
            if locked_until_utc > now:
                remaining_seconds = (locked_until_utc - now).total_seconds()
                retry_minutes = max(1, math.ceil(remaining_seconds / 60))
                raise AccountLockedError(
                    f"Too many failed attempts. Try again in {retry_minutes} minutes."
                )
            # Lockout period expired
            user.locked_until = None
            user.failed_login_attempts = 0

        # Check account active status
        if not user.is_active:
            raise AccountInactiveError(
                "This account has been deactivated. Contact your administrator."
            )

        # Check tenant status
        tenant = await self.tenant_repo.get_by_id(user.tenant_id)
        if not tenant or not tenant.is_active:
            raise AccountInactiveError("This organization account is not active.")

        # Verify password
        if not verify_password(password, user.hashed_password):
            user.failed_login_attempts += 1
            self.audit.record(
                tenant_id=user.tenant_id,
                actor=user,
                action=AuditAction.LOGIN_FAILED,
                entity_type=AuditEntity.USER,
                entity_id=user.id,
                summary=(
                    f"Failed sign-in attempt "
                    f"({user.failed_login_attempts} of "
                    f"{settings.max_failed_login_attempts})"
                ),
                context=context,
            )
            if user.failed_login_attempts >= settings.max_failed_login_attempts:
                user.locked_until = now + timedelta(minutes=settings.lockout_duration_minutes)
                self.audit.record(
                    tenant_id=user.tenant_id,
                    actor=user,
                    action=AuditAction.ACCOUNT_LOCKED,
                    entity_type=AuditEntity.USER,
                    entity_id=user.id,
                    summary=(
                        f"Account locked for "
                        f"{settings.lockout_duration_minutes} minutes after "
                        f"{settings.max_failed_login_attempts} failed attempts"
                    ),
                    context=context,
                )
                await self.session.commit()
                raise AccountLockedError(
                    f"Too many failed attempts. "
                    f"Try again in {settings.lockout_duration_minutes} minutes."
                )
            await self.session.commit()
            raise AuthenticationError("Email or password is incorrect.")

        # Success - reset failure counter
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login_at = now

        access_token = create_access_token(user.id, user.tenant_id, user.role)
        refresh_token = create_refresh_token(user.id, user.tenant_id)

        # Store refresh token
        token_hash = hash_token(refresh_token)
        refresh_expires = now + timedelta(days=settings.refresh_token_expire_days)
        await self.auth_repo.create_refresh_token(user.id, token_hash, refresh_expires)

        self.audit.record(
            tenant_id=user.tenant_id,
            actor=user,
            action=AuditAction.LOGIN_SUCCEEDED,
            entity_type=AuditEntity.USER,
            entity_id=user.id,
            summary="Signed in",
            context=context,
        )

        await self.session.commit()
        return access_token, refresh_token

    async def refresh(self, refresh_token: str) -> tuple[str, str]:
        """Rotate a refresh token and issue a fresh access token."""
        now = datetime.now(UTC)
        payload = decode_jwt_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthenticationError("Invalid token type.")

        token_hash = hash_token(refresh_token)
        stored_token = await self.auth_repo.get_refresh_token_by_hash(token_hash)
        expires_at_utc = ensure_utc(stored_token.expires_at) if stored_token else None
        if (
            not stored_token
            or stored_token.revoked_at is not None
            or expires_at_utc is None
            or expires_at_utc < now
        ):
            raise AuthenticationError("Refresh token is invalid or has expired.")

        user_id = UUID(str(payload.get("sub")))
        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise AccountInactiveError("User account is inactive.")

        tenant = await self.tenant_repo.get_by_id(user.tenant_id)
        if not tenant or not tenant.is_active:
            raise AccountInactiveError("Organization account is inactive.")

        # Revoke used refresh token (rotation)
        await self.auth_repo.revoke_refresh_token(token_hash)

        # Issue new token pair
        new_access = create_access_token(user.id, user.tenant_id, user.role)
        new_refresh = create_refresh_token(user.id, user.tenant_id)
        new_hash = hash_token(new_refresh)
        new_expires = now + timedelta(days=settings.refresh_token_expire_days)
        await self.auth_repo.create_refresh_token(user.id, new_hash, new_expires)

        await self.session.commit()
        return new_access, new_refresh

    async def logout(
        self,
        user_id: UUID,
        refresh_token: str | None = None,
        context: RequestContext | None = None,
    ) -> None:
        """Revoke refresh token session."""
        user = await self.user_repo.get_by_id(user_id)
        if user:
            self.audit.record(
                tenant_id=user.tenant_id,
                actor=user,
                action=AuditAction.LOGGED_OUT,
                entity_type=AuditEntity.USER,
                entity_id=user.id,
                summary="Signed out",
                context=context,
            )
        if refresh_token:
            token_hash = hash_token(refresh_token)
            await self.auth_repo.revoke_refresh_token(token_hash)
        else:
            await self.auth_repo.revoke_all_user_refresh_tokens(user_id)
        await self.session.commit()

    async def forgot_password(
        self,
        email: str,
        mail_sender: MailSender,
        context: RequestContext | None = None,
    ) -> None:
        """Issue a password reset token and email it to the user."""
        users = await self.user_repo.get_by_email(email)
        if not users:
            # Silent return to prevent user enumeration
            return

        user = users[0]
        if not user.is_active:
            return

        now = datetime.now(UTC)
        raw_token = generate_reset_token()
        token_hash = hash_token(raw_token)
        expires_at = now + timedelta(minutes=settings.password_reset_token_expire_minutes)

        await self.auth_repo.create_password_reset_token(user.id, token_hash, expires_at)
        self.audit.record(
            tenant_id=user.tenant_id,
            actor=user,
            action=AuditAction.PASSWORD_RESET_REQUESTED,
            entity_type=AuditEntity.USER,
            entity_id=user.id,
            summary="Requested a password reset link",
            context=context,
        )
        await self.session.commit()

        reset_link = f"{settings.app_url.rstrip('/')}/reset-password?token={raw_token}"
        mins = settings.password_reset_token_expire_minutes
        subject = "Reset your CRM password"
        text_body = (
            f"Hello {user.full_name},\n\n"
            f"We received a request to reset your CRM password.\n"
            f"Follow the link below to set a new password:\n\n"
            f"{reset_link}\n\n"
            f"This link expires in {mins} minutes and can only be used once.\n"
            f"If you did not make this request, you can safely ignore this email.\n"
        )
        button_style = (
            "display:inline-block;padding:10px 20px;"
            "background-color:#18181b;color:#ffffff;"
            "text-decoration:none;border-radius:6px;"
        )
        html_body = (
            f"<p>Hello {user.full_name},</p>"
            f"<p>We received a request to reset your CRM password. Click below to proceed:</p>"
            f'<p><a href="{reset_link}" style="{button_style}">Reset Password</a></p>'
            f"<p>Or copy this link into your browser:<br><code>{reset_link}</code></p>"
            f"<p>This link expires in {mins} minutes and can only be used once.</p>"
        )

        try:
            await mail_sender.send_mail(
                to_email=user.email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
        except (OSError, RuntimeError) as exc:
            logger.warning("Failed to send reset email to %s: %s", user.email, exc)

    async def reset_password(
        self,
        token: str,
        new_password: str,
        context: RequestContext | None = None,
    ) -> None:
        """Validate single-use reset token and update user's password."""
        token_hash = hash_token(token)
        record = await self.auth_repo.get_password_reset_token_by_hash(token_hash)
        if not record:
            raise InvalidTokenError("This reset link is not valid.")

        if record.used_at is not None:
            raise TokenAlreadyUsedError("This reset link has already been used. Request a new one.")

        now = datetime.now(UTC)
        record_expires_utc = ensure_utc(record.expires_at)
        if record_expires_utc is None or record_expires_utc < now:
            raise TokenExpiredError("This reset link has expired. Request a new one.")

        user = await self.user_repo.get_by_id(record.user_id)
        if not user or not user.is_active:
            raise AccountInactiveError("Account is not active.")

        # Update password
        user.hashed_password = hash_password(new_password)
        user.failed_login_attempts = 0
        user.locked_until = None

        # Mark token used
        await self.auth_repo.mark_password_reset_token_used(record.id)
        # Revoke existing refresh tokens for security
        await self.auth_repo.revoke_all_user_refresh_tokens(user.id)

        self.audit.record(
            tenant_id=user.tenant_id,
            actor=user,
            action=AuditAction.PASSWORD_RESET_COMPLETED,
            entity_type=AuditEntity.USER,
            entity_id=user.id,
            summary="Password changed with a reset link; all sessions revoked",
            context=context,
        )

        await self.session.commit()
