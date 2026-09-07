"""Sprint 1 Integration Tests: Multi-tenant Authentication, Lockout, and Password Reset."""

from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.security import generate_reset_token, hash_token
from crm.integrations.mail.console import ConsoleMailSender
from crm.modules.auth.models import PasswordResetToken
from crm.modules.tenants.models import Tenant
from crm.modules.users.models import User


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, admin_user_a: User) -> None:
    """Valid credentials return a token pair."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient, admin_user_a: User) -> None:
    """Wrong password returns 401 and error shape."""
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "WrongPassword123!"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_login_lockout_after_max_attempts(client: AsyncClient, admin_user_a: User) -> None:
    """Five consecutive wrong password attempts trigger a 429 account lockout."""
    for _ in range(4):
        res = await client.post(
            "/api/v1/auth/login",
            json={"email": admin_user_a.email, "password": "WrongPassword123!"},
        )
        assert res.status_code == 401

    # 5th attempt locks the account
    locked_res = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "WrongPassword123!"},
    )
    assert locked_res.status_code == 429
    data = locked_res.json()
    assert data["code"] == "account_locked"
    assert "Too many failed attempts" in data["detail"]

    # Even with correct password, login is blocked while locked
    blocked_res = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    assert blocked_res.status_code == 429


@pytest.mark.asyncio
async def test_login_inactive_user(
    client: AsyncClient, db_session: AsyncSession, admin_user_a: User
) -> None:
    """Deactivated user cannot log in (403)."""
    admin_user_a.is_active = False
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    assert response.status_code == 403
    data = response.json()
    assert data["code"] == "account_inactive"


@pytest.mark.asyncio
async def test_login_inactive_tenant(
    client: AsyncClient, db_session: AsyncSession, tenant_a: Tenant, admin_user_a: User
) -> None:
    """User under deactivated tenant cannot log in (403)."""
    tenant_a.is_active = False
    await db_session.commit()

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_me_returns_profile_and_tenant_and_permissions(
    client: AsyncClient, admin_user_a: User, tenant_a: Tenant, admin_token_a: str
) -> None:
    """Protected /auth/me endpoint returns full session envelope."""
    response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token_a}"},
    )
    assert response.status_code == 200
    data = response.json()

    assert data["user"]["id"] == str(admin_user_a.id)
    assert data["user"]["email"] == admin_user_a.email
    assert data["user"]["role"] == "admin"
    assert data["user"]["is_active"] is True

    assert data["tenant"]["id"] == str(tenant_a.id)
    assert data["tenant"]["name"] == tenant_a.name
    assert data["tenant"]["default_currency"] == tenant_a.default_currency

    assert "users:write" in data["permissions"]
    assert "pipeline:configure" in data["permissions"]


@pytest.mark.asyncio
async def test_unauthenticated_protected_routes_return_401(client: AsyncClient) -> None:
    """DoD: Unauthenticated access to /api/v1/accounts and /api/v1/auth/me returns 401."""
    me_resp = await client.get("/api/v1/auth/me")
    assert me_resp.status_code == 401

    accounts_resp = await client.get("/api/v1/accounts")
    assert accounts_resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_rotation(client: AsyncClient, admin_user_a: User) -> None:
    """Refresh token exchanges for a new token pair and revokes the old one."""
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    refresh_token = login_resp.json()["refresh_token"]

    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 200
    new_tokens = refresh_resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens

    # Attempting to reuse the rotated refresh token must fail
    reuse_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert reuse_resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_session(client: AsyncClient, admin_user_a: User) -> None:
    """Logout endpoint revokes refresh token with 204 status."""
    login_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    access_token = login_resp.json()["access_token"]
    refresh_token = login_resp.json()["refresh_token"]

    logout_resp = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refresh_token": refresh_token},
    )
    assert logout_resp.status_code == 204

    # Refresh should no longer work
    refresh_resp = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_resp.status_code == 401


@pytest.mark.asyncio
async def test_forgot_password_sends_email_and_resets(
    client: AsyncClient,
    admin_user_a: User,
    test_mail_sender: ConsoleMailSender,
) -> None:
    """Full forgot-password and reset-password flow."""
    test_mail_sender.clear()

    # 1. Request password reset
    forgot_resp = await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": admin_user_a.email},
    )
    assert forgot_resp.status_code == 202
    assert len(test_mail_sender.outbox) == 1

    msg = test_mail_sender.outbox[0]
    assert msg.to_email == admin_user_a.email
    assert "token=" in msg.text_body

    # Extract raw token from reset link
    token = msg.text_body.split("token=")[1].split("\n")[0].strip()

    # 2. Reset password with token
    new_password = "NewSecurePassword2026!"
    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": new_password},
    )
    assert reset_resp.status_code == 204

    # 3. Old password fails
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    assert old_login.status_code == 401

    # 4. New password succeeds
    new_login = await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": new_password},
    )
    assert new_login.status_code == 200


@pytest.mark.asyncio
async def test_reset_token_single_use(
    client: AsyncClient,
    admin_user_a: User,
    test_mail_sender: ConsoleMailSender,
) -> None:
    """Reset token cannot be used twice (410 Gone)."""
    await client.post(
        "/api/v1/auth/forgot-password",
        json={"email": admin_user_a.email},
    )
    token = test_mail_sender.outbox[0].text_body.split("token=")[1].split("\n")[0].strip()

    first_reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "PasswordOne123!"},
    )
    assert first_reset.status_code == 204

    second_reset = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "password": "PasswordTwo123!"},
    )
    assert second_reset.status_code == 410
    assert second_reset.json()["code"] == "token_used"


@pytest.mark.asyncio
async def test_reset_token_expired(
    client: AsyncClient,
    db_session: AsyncSession,
    admin_user_a: User,
) -> None:
    """Expired reset token is rejected with 410 Gone."""
    raw_token = generate_reset_token()
    token_hash = hash_token(raw_token)

    expired_record = PasswordResetToken(
        user_id=admin_user_a.id,
        token_hash=token_hash,
        expires_at=datetime.now(UTC) - timedelta(hours=2),
    )
    db_session.add(expired_record)
    await db_session.commit()

    reset_resp = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": raw_token, "password": "NewPassword123!"},
    )
    assert reset_resp.status_code == 410
    assert reset_resp.json()["code"] == "token_expired"


@pytest.mark.asyncio
async def test_tenant_isolation(
    client: AsyncClient,
    admin_user_a: User,
    tenant_a: Tenant,
    admin_token_a: str,
    tenant_b: Tenant,
    admin_token_b: str,
) -> None:
    """User from Tenant A receives Tenant A context;
    User from Tenant B receives Tenant B context.
    """
    res_a = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token_a}"},
    )
    assert res_a.status_code == 200
    assert res_a.json()["tenant"]["id"] == str(tenant_a.id)
    assert res_a.json()["tenant"]["name"] == "Tenant Alpha"

    res_b = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {admin_token_b}"},
    )
    assert res_b.status_code == 200
    assert res_b.json()["tenant"]["id"] == str(tenant_b.id)
    assert res_b.json()["tenant"]["name"] == "Tenant Beta"
