"""Sprint 7 integration tests: Pipelines and Stages management, RBAC, isolation."""

import pytest
from httpx import AsyncClient
from tests.conftest import auth

PIPELINES = "/api/v1/pipelines"
OPPORTUNITIES = "/api/v1/opportunities"


@pytest.mark.asyncio
async def test_pipeline_requires_auth(client: AsyncClient) -> None:
    res = await client.get(f"{PIPELINES}/default")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_get_default_pipeline_seeds_six_stages(
    client: AsyncClient, admin_token_a: str
) -> None:
    res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Standard Sales Pipeline"
    assert data["is_default"] is True
    stages = data["stages"]
    assert len(stages) == 6
    stage_names = [s["name"] for s in stages]
    assert "Qualification" in stage_names
    assert "Closed Won" in stage_names
    assert "Closed Lost" in stage_names


@pytest.mark.asyncio
async def test_admin_can_add_edit_reorder_delete_stage(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    # 1. Get default pipeline
    pipe_res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    pipeline_id = pipe_res.json()["id"]

    # 2. Sales rep cannot add a stage (requires pipeline:configure)
    rep_add = await client.post(
        f"{PIPELINES}/{pipeline_id}/stages",
        headers=auth(rep_token_a),
        json={"name": "Rep Stage", "display_order": 7, "probability": 50},
    )
    assert rep_add.status_code == 403

    # 3. Admin can add a stage
    admin_add = await client.post(
        f"{PIPELINES}/{pipeline_id}/stages",
        headers=auth(admin_token_a),
        json={"name": "Legal Review", "display_order": 7, "probability": 85},
    )
    assert admin_add.status_code == 201
    stage_id = admin_add.json()["id"]
    assert admin_add.json()["name"] == "Legal Review"
    assert admin_add.json()["probability"] == 85

    # 4. Admin can update stage
    update_res = await client.patch(
        f"{PIPELINES}/{pipeline_id}/stages/{stage_id}",
        headers=auth(admin_token_a),
        json={"name": "Executive & Legal Review", "probability": 90},
    )
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Executive & Legal Review"
    assert update_res.json()["probability"] == 90

    # 5. Admin can reorder stages
    reorder_res = await client.post(
        f"{PIPELINES}/{pipeline_id}/stages/reorder",
        headers=auth(admin_token_a),
        json={"stages": [{"id": stage_id, "display_order": 2}]},
    )
    assert reorder_res.status_code == 200

    # 6. Admin can delete the empty stage
    del_res = await client.delete(
        f"{PIPELINES}/{pipeline_id}/stages/{stage_id}",
        headers=auth(admin_token_a),
    )
    assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_tenant_isolation_pipelines(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    pipe_a_res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    pipeline_a_id = pipe_a_res.json()["id"]

    # Tenant B cannot access Tenant A's pipeline
    res = await client.get(f"{PIPELINES}/{pipeline_a_id}", headers=auth(admin_token_b))
    assert res.status_code in (403, 404)
