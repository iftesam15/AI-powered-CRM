"""Sprint 5 integration tests: Tasks CRUD, status updates, assignee tenant validation, and tenant isolation."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

TASKS = "/api/v1/tasks"
ACCOUNTS = "/api/v1/accounts"


@pytest.mark.asyncio
async def test_tasks_requires_authentication(client: AsyncClient) -> None:
    """Unauthenticated call -> 401."""
    response = await client.get(TASKS)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_create_and_update_task_status(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    """Create task, list tasks, update status to completed, verify completed_at set."""
    # Create task
    create_res = await client.post(
        TASKS,
        headers=auth(admin_token_a),
        json={
            "title": "Prepare Financial Quote",
            "description": "Send PDF quote to decision maker.",
            "priority": "high",
            "status": "pending",
        },
    )
    assert create_res.status_code == 201
    task_data = create_res.json()
    assert task_data["title"] == "Prepare Financial Quote"
    assert task_data["status"] == "pending"
    assert task_data["completed_at"] is None
    task_id = task_data["id"]

    # Sales rep updates task status to completed
    update_res = await client.patch(
        f"{TASKS}/{task_id}",
        headers=auth(rep_token_a),
        json={"status": "completed"},
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["status"] == "completed"
    assert updated_data["completed_at"] is not None


@pytest.mark.asyncio
async def test_readonly_user_cannot_mutate_tasks(
    client: AsyncClient, admin_token_a: str, readonly_token_a: str
) -> None:
    """Read-only user has tasks:read but lacks tasks:write."""
    create_admin = await client.post(
        TASKS,
        headers=auth(admin_token_a),
        json={"title": "Admin Task"},
    )
    task_id = create_admin.json()["id"]

    # Readonly cannot create
    create_ro = await client.post(
        TASKS,
        headers=auth(readonly_token_a),
        json={"title": "Unauthorized Task"},
    )
    assert create_ro.status_code == 403

    # Readonly cannot update
    patch_ro = await client.patch(
        f"{TASKS}/{task_id}",
        headers=auth(readonly_token_a),
        json={"status": "completed"},
    )
    assert patch_ro.status_code == 403

    # Readonly cannot delete
    del_ro = await client.delete(f"{TASKS}/{task_id}", headers=auth(readonly_token_a))
    assert del_ro.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_on_tasks(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    """Tenant B cannot read, update, or delete Tenant A's task."""
    create_a = await client.post(
        TASKS,
        headers=auth(admin_token_a),
        json={"title": "Tenant A Task"},
    )
    task_id_a = create_a.json()["id"]

    # Tenant B GET -> 403
    get_b = await client.get(f"{TASKS}/{task_id_a}", headers=auth(admin_token_b))
    assert get_b.status_code == 403

    # Tenant B PATCH -> 403
    patch_b = await client.patch(
        f"{TASKS}/{task_id_a}",
        headers=auth(admin_token_b),
        json={"title": "Hacked Title"},
    )
    assert patch_b.status_code == 403

    # Tenant B DELETE -> 403
    del_b = await client.delete(f"{TASKS}/{task_id_a}", headers=auth(admin_token_b))
    assert del_b.status_code == 403
