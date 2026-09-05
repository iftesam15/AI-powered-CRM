"""Sprint 2 integration tests: the audit spine."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

from crm.modules.audit.constants import AuditAction
from crm.modules.users.models import User

AUDIT = "/api/v1/audit"
USERS = "/api/v1/users"


async def actions_in(client: AsyncClient, token: str) -> list[str]:
    response = await client.get(AUDIT, headers=auth(token))
    assert response.status_code == 200
    return [entry["action"] for entry in response.json()["items"]]


# --- who may read the trail ---


@pytest.mark.asyncio
async def test_audit_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get(AUDIT)).status_code == 401


@pytest.mark.asyncio
async def test_only_admin_may_read_the_audit_log(
    client: AsyncClient,
    admin_token_a: str,
    manager_token_a: str,
    rep_token_a: str,
) -> None:
    """`audit:read` is an admin-only permission; a manager who can read users
    still cannot read the trail."""
    assert (await client.get(AUDIT, headers=auth(admin_token_a))).status_code == 200
    assert (await client.get(AUDIT, headers=auth(manager_token_a))).status_code == 403
    assert (await client.get(AUDIT, headers=auth(rep_token_a))).status_code == 403


@pytest.mark.asyncio
async def test_the_trail_is_append_only(
    client: AsyncClient, admin_token_a: str
) -> None:
    """There is no write route. Nothing can forge or erase an entry over HTTP."""
    for method in (client.post, client.patch, client.put, client.delete):
        response = await method(AUDIT, headers=auth(admin_token_a))
        assert response.status_code == 405


# --- what gets recorded ---


@pytest.mark.asyncio
async def test_user_creation_is_recorded(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    created = await client.post(
        USERS,
        headers=auth(admin_token_a),
        json={
            "email": "recorded@alpha.test",
            "full_name": "Recorded Person",
            "role": "sales_rep",
            "password": "Sprint2demo!",
        },
    )
    assert created.status_code == 201

    entries = (await client.get(AUDIT, headers=auth(admin_token_a))).json()["items"]
    entry = next(e for e in entries if e["action"] == AuditAction.USER_CREATED)

    assert entry["actor_email"] == admin_user_a.email
    assert entry["actor_user_id"] == str(admin_user_a.id)
    assert entry["entity_type"] == "user"
    assert entry["entity_id"] == created.json()["id"]
    assert "Recorded Person" in entry["summary"]
    assert entry["changes"]["role"]["after"] == "sales_rep"


@pytest.mark.asyncio
async def test_role_change_records_before_and_after(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    """US-ADM-03 acceptance: actor, action, entity, entity id and before/after."""
    await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_manager"},
    )

    entries = (await client.get(AUDIT, headers=auth(admin_token_a))).json()["items"]
    entry = next(e for e in entries if e["action"] == AuditAction.USER_ROLE_CHANGED)

    assert entry["entity_id"] == str(rep_user_a.id)
    assert entry["changes"]["role"] == {"before": "sales_rep", "after": "sales_manager"}
    assert "Sales representative" in entry["summary"]
    assert "Sales manager" in entry["summary"]


@pytest.mark.asyncio
async def test_deactivation_records_its_own_action(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"is_active": False},
    )
    assert AuditAction.USER_DEACTIVATED in await actions_in(client, admin_token_a)


@pytest.mark.asyncio
async def test_one_edit_produces_one_row_per_meaningful_change(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    """Renaming someone is a single generic `user.updated`, not a role change
    row as well."""
    await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"full_name": "Renamed Rep"},
    )
    actions = await actions_in(client, admin_token_a)
    assert actions.count(AuditAction.USER_UPDATED) == 1
    assert AuditAction.USER_ROLE_CHANGED not in actions


@pytest.mark.asyncio
async def test_a_patch_that_changes_nothing_records_nothing(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    response = await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": rep_user_a.role},
    )
    assert response.status_code == 200
    assert await actions_in(client, admin_token_a) == []


@pytest.mark.asyncio
async def test_a_rejected_change_leaves_no_trace(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    """The audit row shares the transaction with the action, so a refused edit
    cannot leave a record claiming it happened."""
    blocked = await client.patch(
        f"{USERS}/{admin_user_a.id}",
        headers=auth(admin_token_a),
        json={"is_active": False},
    )
    assert blocked.status_code == 409
    assert await actions_in(client, admin_token_a) == []


# --- authentication events ---


@pytest.mark.asyncio
async def test_successful_sign_in_is_recorded(
    client: AsyncClient, admin_token_a: str, admin_user_a: User
) -> None:
    await client.post(
        "/api/v1/auth/login",
        json={"email": admin_user_a.email, "password": "Sprint1demo!"},
    )
    assert AuditAction.LOGIN_SUCCEEDED in await actions_in(client, admin_token_a)


@pytest.mark.asyncio
async def test_failed_sign_in_and_lockout_are_recorded(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    for _ in range(5):
        await client.post(
            "/api/v1/auth/login",
            json={"email": rep_user_a.email, "password": "WrongPassword123!"},
        )

    actions = await actions_in(client, admin_token_a)
    assert actions.count(AuditAction.LOGIN_FAILED) == 5
    assert AuditAction.ACCOUNT_LOCKED in actions


@pytest.mark.asyncio
async def test_a_login_attempt_for_an_unknown_address_records_nothing(
    client: AsyncClient, admin_token_a: str
) -> None:
    """An unknown email belongs to no tenant, so there is no trail it could
    honestly be written to — and writing one would let an outsider add rows to
    somebody's audit log."""
    await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@nowhere.test", "password": "WrongPassword123!"},
    )
    assert await actions_in(client, admin_token_a) == []


@pytest.mark.asyncio
async def test_password_reset_is_recorded_end_to_end(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    await client.post(
        "/api/v1/auth/forgot-password", json={"email": rep_user_a.email}
    )
    assert AuditAction.PASSWORD_RESET_REQUESTED in await actions_in(
        client, admin_token_a
    )


# --- isolation, filtering, paging ---


@pytest.mark.asyncio
async def test_the_trail_never_crosses_tenants(
    client: AsyncClient,
    admin_token_a: str,
    admin_token_b: str,
    admin_user_b: User,
    rep_user_a: User,
) -> None:
    """Tenant B acts; tenant A's administrator must not see any of it."""
    await client.post(
        USERS,
        headers=auth(admin_token_b),
        json={
            "email": "beta.hire@beta.test",
            "full_name": "Beta Hire",
            "role": "sales_rep",
            "password": "Sprint2demo!",
        },
    )

    assert await actions_in(client, admin_token_a) == []
    assert AuditAction.USER_CREATED in await actions_in(client, admin_token_b)


@pytest.mark.asyncio
async def test_filtering_by_action_and_entity(
    client: AsyncClient, admin_token_a: str, rep_user_a: User
) -> None:
    await client.patch(
        f"{USERS}/{rep_user_a.id}",
        headers=auth(admin_token_a),
        json={"role": "sales_manager"},
    )
    await client.post(
        "/api/v1/auth/login",
        json={"email": rep_user_a.email, "password": "Sprint1demo!"},
    )

    by_action = await client.get(
        AUDIT,
        headers=auth(admin_token_a),
        params={"action": AuditAction.USER_ROLE_CHANGED.value},
    )
    assert by_action.json()["total"] == 1

    by_entity = await client.get(
        AUDIT, headers=auth(admin_token_a), params={"entity_id": str(rep_user_a.id)}
    )
    # Both the role change and the sign-in point at the same user record.
    assert by_entity.json()["total"] == 2


@pytest.mark.asyncio
async def test_entries_are_newest_first_and_page_without_overlap(
    client: AsyncClient, admin_token_a: str
) -> None:
    for index in range(5):
        await client.post(
            USERS,
            headers=auth(admin_token_a),
            json={
                "email": f"hire{index}@alpha.test",
                "full_name": f"Hire {index}",
                "role": "sales_rep",
                "password": "Sprint2demo!",
            },
        )

    first = await client.get(
        AUDIT, headers=auth(admin_token_a), params={"limit": 2, "offset": 0}
    )
    second = await client.get(
        AUDIT, headers=auth(admin_token_a), params={"limit": 2, "offset": 2}
    )

    assert first.json()["total"] == 5
    assert "Hire 4" in first.json()["items"][0]["summary"]

    first_ids = {entry["id"] for entry in first.json()["items"]}
    second_ids = {entry["id"] for entry in second.json()["items"]}
    assert first_ids.isdisjoint(second_ids)


@pytest.mark.asyncio
async def test_action_vocabulary_is_served_to_the_ui(
    client: AsyncClient, admin_token_a: str
) -> None:
    response = await client.get(f"{AUDIT}/actions", headers=auth(admin_token_a))
    assert response.status_code == 200
    assert AuditAction.USER_ROLE_CHANGED in response.json()

    entities = await client.get(f"{AUDIT}/entity-types", headers=auth(admin_token_a))
    assert "user" in entities.json()
