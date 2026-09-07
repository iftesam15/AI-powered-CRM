"""Sprint 4 integration tests: Contacts CRUD, RBAC, account linking, tenant isolation, and duplicate check."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

CONTACTS = "/api/v1/contacts"
ACCOUNTS = "/api/v1/accounts"


@pytest.mark.asyncio
async def test_contacts_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated call -> 401."""
    response = await client.get(CONTACTS)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_and_rep_can_create_and_list_contacts(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    """Both admin and sales_rep have `contacts:write` and `contacts:read`."""
    # First create an account in tenant A
    acc_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Logistics Corp A"},
    )
    assert acc_res.status_code == 201
    account_id = acc_res.json()["id"]

    # Create contact linked to account
    create_res = await client.post(
        CONTACTS,
        headers=auth(admin_token_a),
        json={
            "first_name": "Jane",
            "last_name": "Doe",
            "email": "jane.doe@logistics.example.com",
            "phone": "+15550192834",
            "title": "Director",
            "account_id": account_id,
        },
    )
    assert create_res.status_code == 201
    contact_data = create_res.json()
    assert contact_data["first_name"] == "Jane"
    assert contact_data["last_name"] == "Doe"
    assert contact_data["email"] == "jane.doe@logistics.example.com"
    assert contact_data["account_id"] == account_id
    assert contact_data["account_name"] == "Logistics Corp A"
    contact_id = contact_data["id"]

    # Sales rep can list contacts
    list_res = await client.get(CONTACTS, headers=auth(rep_token_a))
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["total"] >= 1
    assert any(c["id"] == contact_id for c in body["items"])

    # Read contact detail
    get_res = await client.get(f"{CONTACTS}/{contact_id}", headers=auth(rep_token_a))
    assert get_res.status_code == 200
    assert get_res.json()["last_name"] == "Doe"

    # List contacts linked to account
    acc_contacts_res = await client.get(
        f"{ACCOUNTS}/{account_id}/contacts", headers=auth(rep_token_a)
    )
    assert acc_contacts_res.status_code == 200
    acc_contacts = acc_contacts_res.json()
    assert len(acc_contacts) == 1
    assert acc_contacts[0]["id"] == contact_id


@pytest.mark.asyncio
async def test_readonly_user_can_read_but_not_write_contacts(
    client: AsyncClient, admin_token_a: str, readonly_token_a: str
) -> None:
    """Read-only user has `contacts:read` but lacks `contacts:write`."""
    create_res = await client.post(
        CONTACTS,
        headers=auth(admin_token_a),
        json={"first_name": "Readonly", "last_name": "Contact"},
    )
    assert create_res.status_code == 201
    contact_id = create_res.json()["id"]

    # Read-only user can list
    assert (await client.get(CONTACTS, headers=auth(readonly_token_a))).status_code == 200

    # Read-only user cannot update
    update_res = await client.patch(
        f"{CONTACTS}/{contact_id}",
        headers=auth(readonly_token_a),
        json={"title": "Unauthorized Title"},
    )
    assert update_res.status_code == 403

    # Read-only user cannot delete
    del_res = await client.delete(f"{CONTACTS}/{contact_id}", headers=auth(readonly_token_a))
    assert del_res.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_returns_403_for_cross_tenant_access(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Tenant B attempting to access Tenant A's contact gets 403 Forbidden."""
    create_res = await client.post(
        CONTACTS,
        headers=auth(admin_token_a),
        json={"first_name": "Secret", "last_name": "TenantA Person"},
    )
    assert create_res.status_code == 201
    contact_id = create_res.json()["id"]

    # Tenant B cannot see in list
    list_b = await client.get(CONTACTS, headers=auth(admin_token_b))
    assert list_b.status_code == 200
    assert not any(c["id"] == contact_id for c in list_b.json()["items"])

    # Tenant B GET contact by ID -> 403
    get_b = await client.get(f"{CONTACTS}/{contact_id}", headers=auth(admin_token_b))
    assert get_b.status_code == 403

    # Tenant B PATCH contact by ID -> 403
    patch_b = await client.patch(
        f"{CONTACTS}/{contact_id}",
        headers=auth(admin_token_b),
        json={"last_name": "Hacked Name"},
    )
    assert patch_b.status_code == 403

    # Tenant B DELETE contact by ID -> 403
    del_b = await client.delete(f"{CONTACTS}/{contact_id}", headers=auth(admin_token_b))
    assert del_b.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_prevents_linking_contact_to_cross_tenant_account(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Cannot link a contact in Tenant B to an account in Tenant A."""
    acc_res = await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": "Tenant A Private Corp"},
    )
    assert acc_res.status_code == 201
    account_id_a = acc_res.json()["id"]

    # Tenant B tries to create contact linked to Tenant A's account -> 403
    create_cross = await client.post(
        CONTACTS,
        headers=auth(admin_token_b),
        json={
            "first_name": "Infiltrator",
            "last_name": "User",
            "account_id": account_id_a,
        },
    )
    assert create_cross.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_email_check(client: AsyncClient, admin_token_a: str) -> None:
    """Check duplicate email detection endpoint."""
    email = "dup.check@example.com"

    # Before creation, should be false
    check1 = await client.get(f"{CONTACTS}/check-duplicate?email={email}", headers=auth(admin_token_a))
    assert check1.status_code == 200
    assert check1.json()["is_duplicate"] is False

    # Create contact
    await client.post(
        CONTACTS,
        headers=auth(admin_token_a),
        json={"first_name": "Dup", "last_name": "Check", "email": email},
    )

    # After creation, should be true
    check2 = await client.get(f"{CONTACTS}/check-duplicate?email={email}", headers=auth(admin_token_a))
    assert check2.status_code == 200
    assert check2.json()["is_duplicate"] is True
    assert check2.json()["matching_count"] == 1
