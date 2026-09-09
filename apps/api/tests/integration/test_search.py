"""Sprint 8 integration tests: Cross-entity global search."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

SEARCH = "/api/v1/search"
ACCOUNTS = "/api/v1/accounts"
CONTACTS = "/api/v1/contacts"
LEADS = "/api/v1/leads"


@pytest.mark.asyncio
async def test_search_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated search -> 401."""
    response = await client.get(SEARCH, params={"q": "test"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_search_minimum_query_length(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Query shorter than 2 characters -> 400."""
    response = await client.get(
        SEARCH,
        headers=auth(admin_token_a),
        params={"q": "a"},
    )
    assert response.status_code in (400, 422)


@pytest.mark.asyncio
async def test_search_cross_entity_matching(
    client: AsyncClient, admin_token_a: str
) -> None:
    """Search matches accounts, contacts, and leads across tenant A."""
    term = "AcmeAlpha"

    # Create account
    await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": f"{term} Enterprises"},
    )

    # Create contact
    await client.post(
        CONTACTS,
        headers=auth(admin_token_a),
        json={"first_name": "John", "last_name": f"{term}Son", "email": "john@example.com"},
    )

    # Create lead
    await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={"first_name": "Alice", "last_name": "Smith", "company_name": f"{term} Holdings"},
    )

    # Perform search
    res = await client.get(
        SEARCH,
        headers=auth(admin_token_a),
        params={"q": term},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["query"] == term
    assert data["total"] >= 3

    entity_types = {item["entity_type"] for item in data["items"]}
    assert "account" in entity_types
    assert "contact" in entity_types
    assert "lead" in entity_types


@pytest.mark.asyncio
async def test_search_tenant_isolation(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Search results from tenant A are not visible to tenant B."""
    unique_term = "SecretTenantAOnly"

    await client.post(
        ACCOUNTS,
        headers=auth(admin_token_a),
        json={"name": unique_term},
    )

    # Tenant B searches for Tenant A's secret
    res_b = await client.get(
        SEARCH,
        headers=auth(admin_token_b),
        params={"q": unique_term},
    )
    assert res_b.status_code == 200
    assert res_b.json()["total"] == 0
