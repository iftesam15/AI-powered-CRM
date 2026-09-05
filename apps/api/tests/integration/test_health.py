"""Sprint 0 definition of done: the app boots, probes answer, OpenAPI is served."""

from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from crm import __version__


async def test_health_reports_ok(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == __version__
    assert body["environment"] in {"local", "test", "staging", "production"}


async def test_health_does_not_touch_the_database(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Liveness must stay up during a database outage, or orchestrators kill a
    process that is only waiting on its dependency."""

    def explode(*_: Any, **__: Any) -> Any:
        raise AssertionError("/health opened a database session")

    monkeypatch.setattr("crm.core.health.SessionFactory", explode)

    assert (await client.get("/health")).status_code == 200


async def test_ready_reports_the_database_check(client: AsyncClient) -> None:
    response = await client.get("/ready")
    body = response.json()

    assert "database" in body["checks"]
    if body["status"] == "ready":
        assert response.status_code == 200
        assert body["checks"]["database"]["status"] == "ok"
    else:
        # No database available in this environment; the contract still holds.
        assert response.status_code == 503
        assert body["checks"]["database"]["status"] == "error"


async def test_ready_returns_503_when_the_database_is_down(
    app: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    class BrokenSession:
        async def __aenter__(self) -> "BrokenSession":
            raise ConnectionRefusedError("database is down")

        async def __aexit__(self, *_: object) -> None:
            return None

    monkeypatch.setattr("crm.core.health.SessionFactory", lambda: BrokenSession())

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get("/ready")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"]["status"] == "error"


async def test_openapi_is_published(client: AsyncClient) -> None:
    response = await client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "/health" in schema["paths"]
    assert "/ready" in schema["paths"]


async def test_request_id_is_echoed_back(client: AsyncClient) -> None:
    response = await client.get("/health", headers={"x-request-id": "trace-me"})

    assert response.headers["x-request-id"] == "trace-me"
    assert "server-timing" in response.headers


async def test_unknown_route_uses_the_shared_error_shape(client: AsyncClient) -> None:
    response = await client.get("/nope")

    assert response.status_code == 404
    body = response.json()
    assert set(body) >= {"detail", "code"}
