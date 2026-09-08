"""Sprint 5 integration tests: Activities CRUD, timeline aggregation, tenant isolation, and RBAC."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

ACTIVITIES = "/api/v1/activities"
TASKS = "/api/v1/tasks"
ACCOUNTS = "/api/v1/accounts"


@pytest.mark.asyncio
async def test_activities_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated call -> 401."""
    response = await client.get(ACTIVITIES)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_log_activity_and_fetch_timeline(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    """Create account, log activity, verify timeline order and data."""
    # Create account
    acc_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Timeline Testing Account"},
    )
    assert acc_res.status_code == 201
    account_id = acc_res.json()["id"]

    # Log activity
    act_res = await client.post(
        ACTIVITIES,
        headers=auth(admin_token_a),
        json={
            "activity_type": "call",
            "title": "Discovery Session",
            "description": "Initial call to clarify requirements.",
            "entity_type": "account",
            "entity_id": account_id,
        },
    )
    assert act_res.status_code == 201
    act_data = act_res.json()
    assert act_data["title"] == "Discovery Session"
    assert act_data["activity_type"] == "call"
    act_id = act_data["id"]

    # Sales rep can view activity
    get_res = await client.get(f"{ACTIVITIES}/{act_id}", headers=auth(rep_token_a))
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Discovery Session"

    # Fetch timeline for entity
    timeline_res = await client.get(
        f"{ACTIVITIES}/timeline?entity_type=account&entity_id={account_id}",
        headers=auth(rep_token_a),
    )
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    assert len(timeline) >= 1
    assert timeline[0]["raw_id"] == act_id
    assert timeline[0]["item_type"] == "activity"


@pytest.mark.asyncio
async def test_readonly_user_can_read_activities_but_not_log(
    client: AsyncClient, admin_token_a: str, readonly_token_a: str
) -> None:
    """Read-only user has activities:read but lacks activities:write."""
    acc_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Readonly Activity Account"},
    )
    account_id = acc_res.json()["id"]

    # Readonly fails to log activity -> 403
    create_res = await client.post(
        ACTIVITIES,
        headers=auth(readonly_token_a),
        json={
            "activity_type": "note",
            "title": "Unauthorized Note",
            "entity_type": "account",
            "entity_id": account_id,
        },
    )
    assert create_res.status_code == 403

    # Admin logs activity
    admin_log = await client.post(
        ACTIVITIES,
        headers=auth(admin_token_a),
        json={
            "activity_type": "note",
            "title": "Authorized Note",
            "entity_type": "account",
            "entity_id": account_id,
        },
    )
    assert admin_log.status_code == 201

    # Readonly can list activities
    list_res = await client.get(ACTIVITIES, headers=auth(readonly_token_a))
    assert list_res.status_code == 200


@pytest.mark.asyncio
async def test_tenant_isolation_on_activities(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Tenant B cannot access or attach activities to Tenant A's account."""
    acc_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Tenant A Secret Account"},
    )
    account_id_a = acc_res.json()["id"]

    # Tenant B tries to log activity on Tenant A's account -> 403
    log_b = await client.post(
        ACTIVITIES,
        headers=auth(admin_token_b),
        json={
            "activity_type": "meeting",
            "title": "Spying Attempt",
            "entity_type": "account",
            "entity_id": account_id_a,
        },
    )
    assert log_b.status_code == 403

    # Tenant A logs activity
    log_a = await client.post(
        ACTIVITIES,
        headers=auth(admin_token_a),
        json={
            "activity_type": "meeting",
            "title": "Legitimate Meeting",
            "entity_type": "account",
            "entity_id": account_id_a,
        },
    )
    assert log_a.status_code == 201
    act_id_a = log_a.json()["id"]

    # Tenant B cannot read activity -> 403
    get_b = await client.get(f"{ACTIVITIES}/{act_id_a}", headers=auth(admin_token_b))
    assert get_b.status_code == 403

    # Tenant B cannot view timeline of Tenant A's account -> 403
    timeline_b = await client.get(
        f"{ACTIVITIES}/timeline?entity_type=account&entity_id={account_id_a}",
        headers=auth(admin_token_b),
    )
    assert timeline_b.status_code == 403
