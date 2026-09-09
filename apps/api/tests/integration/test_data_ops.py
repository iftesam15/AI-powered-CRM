"""Sprint 8 integration tests: Data operations (CSV import preview, execution, and CSV export)."""

import io
import pytest
from httpx import AsyncClient
from tests.conftest import auth

DATA_OPS = "/api/v1/data-ops"
CONTACTS = "/api/v1/contacts"


@pytest.mark.asyncio
async def test_data_ops_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated import preview / export -> 401."""
    res = await client.get(f"{DATA_OPS}/import/fields/contacts")
    assert res.status_code == 401

    res_exp = await client.get(f"{DATA_OPS}/export/contacts")
    assert res_exp.status_code == 401


@pytest.mark.asyncio
async def test_import_fields_endpoint(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Get importable field options for contacts."""
    res = await client.get(
        f"{DATA_OPS}/import/fields/contacts",
        headers=auth(admin_token_a),
    )
    assert res.status_code == 200
    data = res.json()
    assert data["entity_type"] == "contacts"
    fields = {item["value"]: item["label"] for item in data["fields"]}
    assert "first_name" in fields
    assert "last_name" in fields
    assert "email" in fields


@pytest.mark.asyncio
async def test_import_template_csv(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Download contacts CSV template with schema headers and sample rows."""
    res = await client.get(
        f"{DATA_OPS}/import/template/contacts",
        headers=auth(admin_token_a),
    )
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "contacts_import_template.csv" in res.headers.get("content-disposition", "")

    lines = res.text.strip().splitlines()
    assert lines[0] == "First Name,Last Name,Email,Phone,Job Title"
    assert len(lines) >= 2  # header + at least one sample row
    assert "Jordan" in lines[1] or "example.com" in lines[1]


@pytest.mark.asyncio
async def test_import_template_unsupported_entity(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Unsupported entity type for template -> validation error."""
    res = await client.get(
        f"{DATA_OPS}/import/template/opportunities",
        headers=auth(admin_token_a),
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_import_preview_csv(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Preview a CSV upload."""
    csv_content = "First,Last,Email\nJohn,Doe,john@example.com\nJane,Smith,jane@example.com"
    files = {"file": ("contacts.csv", csv_content, "text/csv")}

    res = await client.post(
        f"{DATA_OPS}/import/preview",
        headers=auth(admin_token_a),
        files=files,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["headers"] == ["First", "Last", "Email"]
    assert data["total_rows"] == 2
    assert len(data["sample_rows"]) == 2
    assert data["sample_rows"][0]["values"]["First"] == "John"


@pytest.mark.asyncio
async def test_import_execute_contacts(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Execute contact import with column mapping."""
    csv_content = "FName,LName,EmailAddr,PhoneNo\nAlice,Wonder,alice@importtest.com,555-1234\nBob,Builder,bob@importtest.com,555-5678"
    files = {"file": ("contacts.csv", csv_content, "text/csv")}
    data_form = {
        "mapping_json": '{"FName":"first_name","LName":"last_name","EmailAddr":"email","PhoneNo":"phone"}'
    }

    res = await client.post(
        f"{DATA_OPS}/import/execute/contacts",
        headers=auth(admin_token_a),
        files=files,
        data=data_form,
    )
    assert res.status_code == 200
    result = res.json()
    assert result["created_count"] == 2
    assert result["error_count"] == 0

    # Verify contacts exist via list contacts API
    list_res = await client.get(
        CONTACTS,
        headers=auth(admin_token_a),
        params={"search": "Wonder"},
    )
    assert list_res.status_code == 200
    contacts_data = list_res.json()
    emails = [c["email"] for c in contacts_data["items"]]
    assert "alice@importtest.com" in emails


@pytest.mark.asyncio
async def test_export_contacts_csv(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Export contacts as CSV."""
    # First create a contact
    await client.post(
        CONTACTS,
        headers=auth(admin_token_a),
        json={"first_name": "Export", "last_name": "Test", "email": "export@test.com"},
    )

    res = await client.get(
        f"{DATA_OPS}/export/contacts",
        headers=auth(admin_token_a),
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    assert "Export" in res.text
    assert "export@test.com" in res.text
