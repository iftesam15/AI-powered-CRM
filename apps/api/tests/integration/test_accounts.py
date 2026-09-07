"""Sprint 3 integration tests: Accounts CRUD, RBAC, pagination, and tenant isolation."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

ACCOUNTS = "/api/v1/accounts"


@pytest.mark.asyncio
async def test_accounts_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated call -> 401."""
    response = await client.get(ACCOUNTS)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_and_rep_can_create_and_list_accounts(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    """Both admin and sales_rep have `accounts:write` and `accounts:read`."""
    create_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={
            "name": "Acme Test Logistics",
            "industry": "Logistics",
            "size": "50-100",
            "website": "acmetest.example.com",
            "address": "123 Main St",
        },
    )
    assert create_res.status_code == 201
    account_data = create_res.json()
    assert account_data["name"] == "Acme Test Logistics"
    assert account_data["website"] == "https://acmetest.example.com"
    account_id = account_data["id"]

    # Sales rep can list and read account
    list_res = await client.get(ACCOUNTS, headers=auth(rep_token_a))
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["total"] == 1
    assert body["items"][0]["id"] == account_id

    # Read account detail
    get_res = await client.get(f"{ACCOUNTS}/{account_id}", headers=auth(rep_token_a))
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Acme Test Logistics"


@pytest.mark.asyncio
async def test_readonly_user_can_read_but_not_write_accounts(
    client: AsyncClient, admin_token_a: str, readonly_token_a: str
) -> None:
    """Read-only user has `accounts:read` but lacks `accounts:write`."""
    # Create account as admin
    create_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Readonly Test Account"},
    )
    assert create_res.status_code == 201
    account_id = create_res.json()["id"]

    # Read-only user can list
    assert (await client.get(ACCOUNTS, headers=auth(readonly_token_a))).status_code == 200

    # Read-only user cannot update
    update_res = await client.patch(
        f"{ACCOUNTS}/{account_id}",
        headers=auth(readonly_token_a),
        json={"industry": "Testing"},
    )
    assert update_res.status_code == 403

    # Read-only user cannot delete
    del_res = await client.delete(f"{ACCOUNTS}/{account_id}", headers=auth(readonly_token_a))
    assert del_res.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_returns_403_for_cross_tenant_access(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Tenant B attempting to access Tenant A's account gets 403 Forbidden."""
    # Create account in Tenant A
    create_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Tenant A Secret Account"},
    )
    assert create_res.status_code == 201
    account_id = create_res.json()["id"]

    # Tenant B cannot see account in list
    list_b = await client.get(ACCOUNTS, headers=auth(admin_token_b))
    assert list_b.status_code == 200
    assert list_b.json()["total"] == 0

    # Tenant B GET account by ID -> 403
    get_b = await client.get(f"{ACCOUNTS}/{account_id}", headers=auth(admin_token_b))
    assert get_b.status_code == 403

    # Tenant B PATCH account by ID -> 403
    patch_b = await client.patch(
        f"{ACCOUNTS}/{account_id}",
        headers=auth(admin_token_b),
        json={"name": "Hacked Name"},
    )
    assert patch_b.status_code == 403

    # Tenant B DELETE account by ID -> 403
    del_b = await client.delete(f"{ACCOUNTS}/{account_id}", headers=auth(admin_token_b))
    assert del_b.status_code == 403


@pytest.mark.asyncio
async def test_account_update_and_delete_flow(client: AsyncClient, admin_token_a: str) -> None:
    """Full update and delete flow with duplicate name conflict prevention."""
    res1 = await client.post(ACCOUNTS, headers=auth(admin_token_a), json={"name": "Account 1"})
    res2 = await client.post(ACCOUNTS, headers=auth(admin_token_a), json={"name": "Account 2"})
    assert res1.status_code == 201
    assert res2.status_code == 201
    acc1_id = res1.json()["id"]

    # Updating Account 1 name to Account 2 -> 499/409 Conflict
    conflict_res = await client.patch(
        f"{ACCOUNTS}/{acc1_id}",
        headers=auth(admin_token_a),
        json={"name": "Account 2"},
    )
    assert conflict_res.status_code in (409, 400)

    # Valid update
    update_res = await client.patch(
        f"{ACCOUNTS}/{acc1_id}",
        headers=auth(admin_token_a),
        json={"industry": "Technology", "size": "100-500"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["industry"] == "Technology"
    assert update_res.json()["size"] == "100-500"

    # Delete
    del_res = await client.delete(f"{ACCOUNTS}/{acc1_id}", headers=auth(admin_token_a))
    assert del_res.status_code == 204

    # Verify deleted
    get_res = await client.get(f"{ACCOUNTS}/{acc1_id}", headers=auth(admin_token_a))
    assert get_res.status_code == 403
