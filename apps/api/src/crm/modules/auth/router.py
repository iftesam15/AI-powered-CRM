"""Authentication HTTP router."""

from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.database import get_db
from crm.core.dependencies import RequestContextDep, get_current_tenant, get_current_user
from crm.core.rbac import get_permissions_for_role
from crm.integrations.mail import get_mail_sender
from crm.integrations.mail.protocol import MailSender
from crm.modules.auth.schemas import (
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    RefreshRequest,
    ResetPasswordRequest,
    TenantSessionRead,
    TokenResponse,
    UserSessionRead,
)
from crm.modules.auth.service import AuthService
from crm.modules.tenants.models import Tenant
from crm.modules.users.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User sign in",
)
async def login(
    payload: LoginRequest,
    context: RequestContextDep,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Authenticate with email and password to receive access and refresh tokens."""
    service = AuthService(session)
    access_token, refresh_token = await service.login(
        payload.email, payload.password, context
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token",
)
async def refresh(
    payload: RefreshRequest,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """Exchange a valid refresh token for a new access token and rotated refresh token."""
    service = AuthService(session)
    access_token, new_refresh_token = await service.refresh(payload.refresh_token)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Sign out",
)
async def logout(
    current_user: Annotated[User, Depends(get_current_user)],
    context: RequestContextDep,
    session: Annotated[AsyncSession, Depends(get_db)],
    payload: RefreshRequest | None = None,
) -> Response:
    """Revoke the current session and refresh token."""
    service = AuthService(session)
    await service.logout(
        current_user.id, payload.refresh_token if payload else None, context
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=MeResponse,
    summary="Get current user profile and tenant context",
)
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
    current_tenant: Annotated[Tenant, Depends(get_current_tenant)],
) -> MeResponse:
    """Return the authenticated user's profile, tenant, and effective permissions."""
    return MeResponse(
        user=UserSessionRead(
            id=str(current_user.id),
            email=current_user.email,
            full_name=current_user.full_name,
            role=current_user.role,
            is_active=current_user.is_active,
        ),
        tenant=TenantSessionRead(
            id=str(current_tenant.id),
            name=current_tenant.name,
            default_currency=current_tenant.default_currency,
            locale=current_tenant.locale,
        ),
        permissions=get_permissions_for_role(current_user.role),
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Request password reset link",
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    context: RequestContextDep,
    session: Annotated[AsyncSession, Depends(get_db)],
    mail_sender: Annotated[MailSender, Depends(get_mail_sender)],
) -> Response:
    """Initiate a password reset flow. Delivers a single-use token link by email."""
    service = AuthService(session)
    await service.forgot_password(payload.email, mail_sender, context)
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reset password with token",
)
async def reset_password(
    payload: ResetPasswordRequest,
    context: RequestContextDep,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> Response:
    """Set a new password using a valid, unexpired password reset token."""
    service = AuthService(session)
    await service.reset_password(payload.token, payload.password, context)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
