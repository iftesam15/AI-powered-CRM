"""Sprint 6 integration tests: Leads CRUD, RBAC, tenant isolation, conversion, and immutability."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

LEADS = "/api/v1/leads"
CONTACTS = "/api/v1/contacts"
ACCOUNTS = "/api/v1/accounts"


@pytest.mark.asyncio
async def test_leads_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated call -> 401."""
    response = await client.get(LEADS)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_admin_and_rep_can_create_list_and_get_leads(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    """Both admin and sales_rep have `leads:write` and `leads:read`."""
    create_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={
            "first_name": "Robert",
            "last_name": "Vance",
            "email": "rvance@vancerefrigeration.example.com",
            "phone": "+15550198823",
            "company_name": "Vance Refrigeration",
            "title": "Owner",
            "status": "new",
            "source": "website",
        },
    )
    assert create_res.status_code == 201
    lead_data = create_res.json()
    assert lead_data["first_name"] == "Robert"
    assert lead_data["last_name"] == "Vance"
    assert lead_data["company_name"] == "Vance Refrigeration"
    assert lead_data["is_converted"] is False
    lead_id = lead_data["id"]

    # Sales rep lists leads
    list_res = await client.get(LEADS, headers=auth(rep_token_a))
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["total"] >= 1
    assert any(l["id"] == lead_id for l in body["items"])

    # Sales rep gets single lead
    get_res = await client.get(f"{LEADS}/{lead_id}", headers=auth(rep_token_a))
    assert get_res.status_code == 200
    assert get_res.json()["last_name"] == "Vance"


@pytest.mark.asyncio
async def test_readonly_user_can_read_but_not_write_leads(
    client: AsyncClient, admin_token_a: str, readonly_token_a: str
) -> None:
    """Read-only user has `leads:read` but lacks `leads:write`."""
    create_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={"first_name": "Andy", "last_name": "Bernard", "status": "new"},
    )
    assert create_res.status_code == 201
    lead_id = create_res.json()["id"]

    # Read-only can list & get
    list_res = await client.get(LEADS, headers=auth(readonly_token_a))
    assert list_res.status_code == 200

    get_res = await client.get(f"{LEADS}/{lead_id}", headers=auth(readonly_token_a))
    assert get_res.status_code == 200

    # Read-only cannot create, update, or convert
    forbidden_create = await client.post(
        LEADS,
        headers=auth(readonly_token_a),
        json={"first_name": "Fail", "last_name": "Test"},
    )
    assert forbidden_create.status_code == 403

    forbidden_patch = await client.patch(
        f"{LEADS}/{lead_id}",
        headers=auth(readonly_token_a),
        json={"status": "qualified"},
    )
    assert forbidden_patch.status_code == 403

    forbidden_convert = await client.post(
        f"{LEADS}/{lead_id}/convert",
        headers=auth(readonly_token_a),
        json={"create_account": True},
    )
    assert forbidden_convert.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_leads(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Tenant B cannot access Tenant A's lead ID (returns 403)."""
    create_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={"first_name": "Secret", "last_name": "Lead A", "status": "new"},
    )
    assert create_res.status_code == 201
    lead_id_a = create_res.json()["id"]

    get_res = await client.get(f"{LEADS}/{lead_id_a}", headers=auth(admin_token_b))
    assert get_res.status_code == 403

    patch_res = await client.patch(
        f"{LEADS}/{lead_id_a}",
        headers=auth(admin_token_b),
        json={"status": "qualified"},
    )
    assert patch_res.status_code == 403

    convert_res = await client.post(
        f"{LEADS}/{lead_id_a}/convert",
        headers=auth(admin_token_b),
        json={"create_account": True},
    )
    assert convert_res.status_code == 403


@pytest.mark.asyncio
async def test_lead_conversion_transactional(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Converting a lead creates Contact & Account and updates lead status to converted."""
    create_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={
            "first_name": "Stanley",
            "last_name": "Hudson",
            "email": "shudson@crossword.example.com",
            "phone": "+15550193382",
            "company_name": "Hudson Logistics",
            "title": "Supply Coordinator",
            "status": "qualified",
        },
    )
    assert create_res.status_code == 201
    lead_id = create_res.json()["id"]

    convert_res = await client.post(
        f"{LEADS}/{lead_id}/convert",
        headers=auth(admin_token_a),
        json={
            "create_account": True,
            "account_name": "Hudson Logistics Corp",
        },
    )
    assert convert_res.status_code == 200
    conv_data = convert_res.json()
    assert conv_data["lead"]["is_converted"] is True
    assert conv_data["lead"]["status"] == "converted"
    assert conv_data["contact_id"] is not None
    assert conv_data["account_id"] is not None

    contact_id = conv_data["contact_id"]
    account_id = conv_data["account_id"]

    # Verify created Contact exists and is linked to Account
    contact_res = await client.get(f"{CONTACTS}/{contact_id}", headers=auth(admin_token_a))
    assert contact_res.status_code == 200
    c_data = contact_res.json()
    assert c_data["first_name"] == "Stanley"
    assert c_data["last_name"] == "Hudson"
    assert c_data["account_id"] == account_id

    # Verify created Account exists
    acc_res = await client.get(f"{ACCOUNTS}/{account_id}", headers=auth(admin_token_a))
    assert acc_res.status_code == 200
    assert acc_res.json()["name"] == "Hudson Logistics Corp"


@pytest.mark.asyncio
async def test_double_conversion_rejected(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Converting an already converted lead returns error."""
    create_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={"first_name": "Phyllis", "last_name": "Vance", "status": "qualified"},
    )
    lead_id = create_res.json()["id"]

    # First conversion
    c1 = await client.post(
        f"{LEADS}/{lead_id}/convert",
        headers=auth(admin_token_a),
        json={"create_account": False},
    )
    assert c1.status_code == 200

    # Second conversion attempt
    c2 = await client.post(
        f"{LEADS}/{lead_id}/convert",
        headers=auth(admin_token_a),
        json={"create_account": False},
    )
    assert c2.status_code in (400, 409, 422)


@pytest.mark.asyncio
async def test_converted_lead_cannot_be_updated(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Updating a converted lead returns error."""
    create_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={"first_name": "Creed", "last_name": "Bratton", "status": "qualified"},
    )
    lead_id = create_res.json()["id"]

    await client.post(
        f"{LEADS}/{lead_id}/convert",
        headers=auth(admin_token_a),
        json={"create_account": False},
    )

    update_res = await client.patch(
        f"{LEADS}/{lead_id}",
        headers=auth(admin_token_a),
        json={"first_name": "NewCreed"},
    )
    assert update_res.status_code in (400, 409, 422)
