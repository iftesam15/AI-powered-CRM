"""Sprint 2 integration tests: user administration, RBAC and tenant isolation."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

from crm.core.security import create_access_token
from crm.modules.users.models import User

USERS = "/api/v1/users"


# --- RBAC: the same route, four different answers ---


@pytest.mark.asyncio
async def test_list_users_requires_authentication(client: AsyncClient) -> None:
    """No token at all is a 401, not a 403."""
    response = await client.get(USERS)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_can_list_users(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    response = await client.get(USERS, headers=auth(admin_token_a))
    assert response.status_code == 200

    body = response.json()
    assert body["total"] == 2
    assert {item["email"] for item in body["items"]} == {
        "admin@alpha.test",
        "rep@alpha.test",
    }
    # The envelope every list endpoint returns from here on.
    assert body["limit"] == 25
    assert body["offset"] == 0


@pytest.mark.asyncio
async def test_manager_can_read_but_not_write_users(
    client: AsyncClient, manager_token_a: str
) -> None:
    """`users:read` without `users:write` is exactly the manager's position."""
    assert (await client.get(USERS, headers=auth(manager_token_a))).status_code == 200

    created = await client.post(
        USERS,
        headers=auth(manager_token_a),
        json={
            "email": "new@alpha.test",
            "full_name": "New Person",
            "role": "sales_rep",
            "password": "Sprint2demo!",
        },
    )
    assert created.status_code == 403
    assert created.json()["code"] == "forbidden"


@pytest.mark.asyncio
async def test_rep_cannot_read_or_write_users(
    client: AsyncClient, rep_token_a: str, admin_user_a: User
) -> None:
    """A sales rep has neither permission, so the admin surface is invisible."""
    assert (await client.get(USERS, headers=auth(rep_token_a))).status_code == 403

    response = await client.patch(
        f"{USERS}/{admin_user_a.id}",
        headers=auth(rep_token_a),
        json={"is_active": False},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_readonly_cannot_read_users(
    client: AsyncClient, readonly_token_a: str
) -> None:
    assert (await client.get(USERS, headers=auth(readonly_token_a))).status_code == 403


# --- create ---


@pytest.mark.asyncio
async def test_admin_creates_user_who_can_then_sign_in(
    client: AsyncClient, admin_token_a: str
) -> None:
    """The sprint demo path: admin creates a rep, rep signs in."""
    created = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": "Newrep@Alpha.test",
            "full_name": "  New Rep  ",
            "role": "sales_rep",
            "password": "Sprint2demo!",
        },
    )
    assert created.status_code == 201

    body = created.json()
    assert body["email"] == "newrep@alpha.test"  # normalised
    assert body["full_name"] == "New Rep"  # trimmed
    assert body["role"] == "sales_rep"
    assert body["is_active"] is True
    assert "password" not in body
    assert "hashed_password" not in body

    signed_in = await client.post(
        "/api/v1/auth/login",
        json={"email": "newrep@alpha.test", "password": "Sprint2demo!"},
    )
    assert signed_in.status_code == 200


@pytest.mark.asyncio
async def test_create_user_lands_in_the_actors_tenant_not_the_bodys(
    client: AsyncClient, admin_token_a: str, admin_user_a: User, tenant_b: object
) -> None:
    """A tenant id in the body is ignored, not honoured."""
    created = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": "planted@beta.test",
            "full_name": "Planted",
            "role": "admin",
            "password": "Sprint2demo!",
            "tenant_id": "11111111-1111-4111-8111-111111111111",
        },
    )
    assert created.status_code == 201
    assert created.json()["tenant_id"] == str(admin_user_a.tenant_id)


@pytest.mark.asyncio
async def test_duplicate_email_within_tenant_conflicts(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    response = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": rep_user_a.email,
            "full_name": "Impostor",
            "role": "sales_rep",
            "password": "Sprint2demo!",
        },
    )
    assert response.status_code == 409
    assert response.json()["code"] == "conflict"


@pytest.mark.asyncio
async def test_same_email_in_another_tenant_is_allowed(
    client: AsyncClient, admin_token_b: str, rep_user_a: User
) -> None:
    """Email is unique per tenant, not globally: two organisations may both
    employ the same address."""
    response = await client.post(
        USERS,
        headers=auth(admin_token_b),
        json={
            "email": rep_user_a.email,
            "full_name": "Beta Namesake",
            "role": "sales_rep",
            "password": "Sprint2demo!",
        },
    )
    assert response.status_code == 201


@pytest.mark.asyncio
async def test_short_password_is_rejected(
    client: AsyncClient, admin_token_a: str
) -> None:
    response = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": "weak@alpha.test",
            "full_name": "Weak",
            "role": "sales_rep",
            "password": "short",
        },
    )
    assert response.status_code == 422
    assert "password" in response.json()["fieldErrors"]


# --- update, and the guards around it ---


@pytest.mark.asyncio
async def test_admin_changes_a_role(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    response = await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_manager"},
    )
    assert response.status_code == 200
    assert response.json()["role"] == "sales_manager"


@pytest.mark.asyncio
async def test_role_change_takes_effect_on_the_next_request(
    client: AsyncClient,
    admin_token_a: str,
    rep_token_a: str,
    rep_user_a: User,
) -> None:
    """US-ADM-01: authorization is re-derived per request, not baked into the
    token at sign-in. The rep's existing token starts working for `users:read`
    the moment they are promoted."""
    assert (await client.get(USERS, headers=auth(rep_token_a))).status_code == 403

    promoted = await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_manager"},
    )
    assert promoted.status_code == 200

    assert (await client.get(USERS, headers=auth(rep_token_a))).status_code == 200


@pytest.mark.asyncio
async def test_deactivated_user_cannot_sign_in(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    """US-ADM-01 acceptance: deactivated users cannot log in."""
    response = await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"is_active": False},
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    signed_in = await client.post(
        "/api/v1/auth/login",
        json={"email": rep_user_a.email, "password": "Sprint1demo!"},
    )
    assert signed_in.status_code == 403
    assert signed_in.json()["code"] == "account_inactive"


@pytest.mark.asyncio
async def test_admin_cannot_deactivate_themselves(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    response = await client.patch(
        f"{USERS}/{admin_user_a.id}",
        headers=auth(admin_token_a),
        json={"is_active": False},
    )
    assert response.status_code == 409
    assert "your own account" in response.json()["detail"]


@pytest.mark.asyncio
async def test_sole_admin_cannot_demote_themselves(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    """The last active administrator cannot step down and strand the tenant."""
    response = await client.patch(
        f"{USERS}/{admin_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_rep"},
    )
    assert response.status_code == 409
    assert "last active administrator" in response.json()["detail"]


@pytest.mark.asyncio
async def test_admin_may_step_down_once_another_admin_exists(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    """The same edit is allowed the moment the tenant has a second admin, and
    the demoted admin immediately loses `users:write`."""
    created = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": "second.admin@alpha.test",
            "full_name": "Second Admin",
            "role": "admin",
            "password": "Sprint2demo!",
        },
    )
    assert created.status_code == 201

    stepped_down = await client.patch(
        f"{USERS}/{admin_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_manager"},
    )
    assert stepped_down.status_code == 200
    assert stepped_down.json()["role"] == "sales_manager"

    # Same token, next request: reads still work, writes no longer do.
    assert (await client.get(USERS, headers=auth(admin_token_a))).status_code == 200
    locked_out = await client.patch(
        f"{USERS}/{created.json()['id']}",
        headers=auth(admin_token_a),
        json={"role": "sales_rep"},
    )
    assert locked_out.status_code == 403


@pytest.mark.asyncio
async def test_last_active_admin_cannot_be_deactivated(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    """Reached through a second admin who deactivates the first, leaving
    themselves as the only one — and is refused when they try to go further."""
    created = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": "second.admin@alpha.test",
            "full_name": "Second Admin",
            "role": "admin",
            "password": "Sprint2demo!",
        },
    )
    second_id = created.json()["id"]
    second_token = create_access_token(second_id, admin_user_a.tenant_id, "admin")

    # Two active admins, so deactivating the first is allowed.
    deactivated = await client.patch(
        f"{USERS}/{admin_user_a.id}",
        headers=auth(second_token),
        json={"is_active": False},
    )
    assert deactivated.status_code == 200

    # The second admin is now the only one, and cannot demote themselves.
    blocked = await client.patch(
        f"{USERS}/{second_id}",
        headers=auth(second_token),
        json={"role": "sales_rep"},
    )
    assert blocked.status_code == 409
    assert "last active administrator" in blocked.json()["detail"]


@pytest.mark.asyncio
async def test_reactivating_a_user_clears_their_lockout(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    """Five bad passwords lock the rep out; switching the account off and back
    on is expected to make it usable now, not in fifteen minutes."""
    for _ in range(5):
        await client.post(
            "/api/v1/auth/login",
            json={"email": rep_user_a.email, "password": "WrongPassword123!"},
        )

    locked = await client.get(f"{USERS}/{rep_user_a.id}", headers=auth(admin_token_a))
    assert locked.json()["is_locked"] is True

    await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"is_active": False},
    )
    reactivated = await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"is_active": True},
    )
    assert reactivated.status_code == 200
    assert reactivated.json()["is_locked"] is False

    signed_in = await client.post(
        "/api/v1/auth/login",
        json={"email": rep_user_a.email, "password": "Sprint1demo!"},
    )
    assert signed_in.status_code == 200


@pytest.mark.asyncio
async def test_email_is_not_updatable(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    """`email` is not on `UserUpdate`, so sending it changes nothing."""
    response = await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"email": "hijacked@alpha.test", "full_name": "Renamed Rep"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == rep_user_a.email
    assert response.json()["full_name"] == "Renamed Rep"


# --- tenant isolation ---


@pytest.mark.asyncio
async def test_list_never_leaks_another_tenants_users(
    client: AsyncClient, admin_token_a: str, rep_user_a: User, admin_user_b: User
) -> None:
    response = await client.get(USERS, headers=auth(admin_token_a))
    emails = {item["email"] for item in response.json()["items"]}
    assert admin_user_b.email not in emails


@pytest.mark.asyncio
async def test_reading_another_tenants_user_is_forbidden(
    client: AsyncClient, admin_token_a: str, admin_user_b: User
) -> None:
    """403, not 404: a different answer for "exists elsewhere" versus "does not
    exist" would let a caller enumerate ids across tenants."""
    response = await client.get(
        f"{USERS}/{admin_user_b.id}", headers=auth(admin_token_a)
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_updating_another_tenants_user_is_forbidden(
    client: AsyncClient, admin_token_a: str, admin_user_b: User
) -> None:
    response = await client.patch(
        f"{USERS}/{admin_user_b.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_rep"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_unknown_id_answers_the_same_as_another_tenants_id(
    client: AsyncClient, admin_token_a: str
) -> None:
    response = await client.get(
        f"{USERS}/00000000-0000-4000-8000-000000000000",
        headers=auth(admin_token_a),
    )
    assert response.status_code == 403


# --- listing: search, filter, page ---


@pytest.mark.asyncio
async def test_search_filter_and_pagination(
    client: AsyncClient,
    admin_token_a: str,
    rep_user_a: User,
    manager_user_a: User,
    readonly_user_a: User,
) -> None:
    by_name = await client.get(
        USERS, headers=auth(admin_token_a), params={"q": "Manager"}
    )
    assert [item["email"] for item in by_name.json()["items"]] == ["manager@alpha.test"]

    by_role = await client.get(
        USERS, headers=auth(admin_token_a), params={"role": "sales_rep"}
    )
    assert by_role.json()["total"] == 1

    first_page = await client.get(
        USERS, headers=auth(admin_token_a), params={"limit": 2, "offset": 0}
    )
    second_page = await client.get(
        USERS, headers=auth(admin_token_a), params={"limit": 2, "offset": 2}
    )
    assert first_page.json()["total"] == 4
    assert len(first_page.json()["items"]) == 2
    assert len(second_page.json()["items"]) == 2

    # Pages must not overlap, which is what the tie-breaking sort buys.
    first_ids = {item["id"] for item in first_page.json()["items"]}
    second_ids = {item["id"] for item in second_page.json()["items"]}
    assert first_ids.isdisjoint(second_ids)


@pytest.mark.asyncio
async def test_unknown_sort_column_falls_back_instead_of_failing(
    client: AsyncClient, admin_token_a: str
) -> None:
    """A sort field outside the allow-list is ignored, never interpolated."""
    response = await client.get(
        USERS, headers=auth(admin_token_a), params={"sort": "hashed_password"}
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_limit_above_the_maximum_is_rejected(
    client: AsyncClient, admin_token_a: str
) -> None:
    response = await client.get(USERS, headers=auth(admin_token_a), params={"limit": 500})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_role_catalogue_lists_permissions(
    client: AsyncClient, admin_token_a: str
) -> None:
    response = await client.get(f"{USERS}/roles", headers=auth(admin_token_a))
    assert response.status_code == 200

    roles = {item["value"]: item for item in response.json()}
    assert set(roles) == {"admin", "sales_manager", "sales_rep", "read_only"}
    assert "users:write" in roles["admin"]["permissions"]
    assert "users:write" not in roles["sales_manager"]["permissions"]
    assert "users:read" in roles["sales_manager"]["permissions"]
    assert "accounts:write" not in roles["read_only"]["permissions"]
