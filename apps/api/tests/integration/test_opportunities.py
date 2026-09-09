"""Sprint 7 integration tests: Opportunities CRUD, stage movement, loss reason validation, summary metrics, and tenant isolation."""

from decimal import Decimal
import pytest
from httpx import AsyncClient
from tests.conftest import auth

OPPORTUNITIES = "/api/v1/opportunities"
PIPELINES = "/api/v1/pipelines"
LEADS = "/api/v1/leads"


@pytest.mark.asyncio
async def test_opportunities_requires_auth(client: AsyncClient) -> None:
    res = await client.get(OPPORTUNITIES)
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_create_and_read_opportunity(
    client: AsyncClient, admin_token_a: str, rep_token_a: str
) -> None:
    create_res = await client.post(
        OPPORTUNITIES,
        headers=auth(rep_token_a),
        json={
            "name": "Acme Route Expansion",
            "amount": "50000.00",
            "currency": "USD",
            "notes": "Key target for Q4.",
        },
    )
    assert create_res.status_code == 201
    opp_data = create_res.json()
    assert opp_data["name"] == "Acme Route Expansion"
    assert Decimal(opp_data["amount"]) == Decimal("50000.00")
    assert opp_data["status"] == "open"
    assert opp_data["probability"] == 10  # default stage probability
    assert len(opp_data["stage_history"]) == 1
    opp_id = opp_data["id"]

    # Read opportunity
    get_res = await client.get(f"{OPPORTUNITIES}/{opp_id}", headers=auth(admin_token_a))
    assert get_res.status_code == 200
    assert get_res.json()["id"] == opp_id


@pytest.mark.asyncio
async def test_readonly_user_cannot_create_opportunity(
    client: AsyncClient, readonly_token_a: str
) -> None:
    res = await client.post(
        OPPORTUNITIES,
        headers=auth(readonly_token_a),
        json={"name": "Forbidden Deal", "amount": "10000.00"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_stage_movement_and_history(
    client: AsyncClient, admin_token_a: str
) -> None:
    # 1. Get pipeline stages
    pipe_res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    stages = pipe_res.json()["stages"]
    stage_disc = next(s for s in stages if s["name"] == "Discovery")

    # 2. Create opp
    create_res = await client.post(
        OPPORTUNITIES,
        headers=auth(admin_token_a),
        json={"name": "Deal Progression Test", "amount": "75000.00"},
    )
    opp_id = create_res.json()["id"]

    # 3. Move stage to Discovery
    move_res = await client.post(
        f"{OPPORTUNITIES}/{opp_id}/move-stage",
        headers=auth(admin_token_a),
        json={"stage_id": stage_disc["id"]},
    )
    assert move_res.status_code == 200
    moved_data = move_res.json()
    assert moved_data["stage_id"] == stage_disc["id"]
    assert moved_data["probability"] == stage_disc["probability"]
    assert len(moved_data["stage_history"]) == 2
    assert moved_data["stage_history"][-1]["to_stage_id"] == stage_disc["id"]


@pytest.mark.asyncio
async def test_closed_lost_requires_loss_reason(
    client: AsyncClient, admin_token_a: str
) -> None:
    pipe_res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    stages = pipe_res.json()["stages"]
    stage_lost = next(s for s in stages if s["is_lost"])

    create_res = await client.post(
        OPPORTUNITIES,
        headers=auth(admin_token_a),
        json={"name": "Loss Test Deal", "amount": "20000.00"},
    )
    opp_id = create_res.json()["id"]

    # Move to Lost stage without loss_reason -> Rejected with 422!
    fail_move = await client.post(
        f"{OPPORTUNITIES}/{opp_id}/move-stage",
        headers=auth(admin_token_a),
        json={"stage_id": stage_lost["id"]},
    )
    assert fail_move.status_code == 422

    # Move with empty loss_reason -> Rejected with 422!
    fail_move2 = await client.post(
        f"{OPPORTUNITIES}/{opp_id}/move-stage",
        headers=auth(admin_token_a),
        json={"stage_id": stage_lost["id"], "loss_reason": "   "},
    )
    assert fail_move2.status_code == 422

    # /lost endpoint without loss_reason -> 422
    fail_close = await client.post(
        f"{OPPORTUNITIES}/{opp_id}/lost",
        headers=auth(admin_token_a),
        json={},
    )
    assert fail_close.status_code == 422

    # Provide valid loss_reason -> Succeeds
    ok_move = await client.post(
        f"{OPPORTUNITIES}/{opp_id}/lost",
        headers=auth(admin_token_a),
        json={"loss_reason": "Budget cut by client executive board."},
    )
    assert ok_move.status_code == 200
    body = ok_move.json()
    assert body["status"] == "lost"
    assert body["probability"] == 0
    assert body["loss_reason"] == "Budget cut by client executive board."
    assert body["lost_at"] is not None


@pytest.mark.asyncio
async def test_closed_won(
    client: AsyncClient, admin_token_a: str
) -> None:
    create_res = await client.post(
        OPPORTUNITIES,
        headers=auth(admin_token_a),
        json={"name": "Victory Deal", "amount": "100000.00"},
    )
    opp_id = create_res.json()["id"]

    won_res = await client.post(
        f"{OPPORTUNITIES}/{opp_id}/won",
        headers=auth(admin_token_a),
        json={"notes": "Signed multi-year agreement."},
    )
    assert won_res.status_code == 200
    body = won_res.json()
    assert body["status"] == "won"
    assert body["probability"] == 100
    assert body["won_at"] is not None


@pytest.mark.asyncio
async def test_pipeline_summary_metrics(
    client: AsyncClient, admin_token_a: str
) -> None:
    pipe_res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    pipeline_id = pipe_res.json()["id"]

    summary_res = await client.get(
        f"{OPPORTUNITIES}/summary?pipeline_id={pipeline_id}",
        headers=auth(admin_token_a),
    )
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert "total_opportunities" in summary
    assert "total_pipeline_value" in summary
    assert "weighted_pipeline_value" in summary
    assert "stages" in summary
    assert len(summary["stages"]) >= 6


@pytest.mark.asyncio
async def test_lead_conversion_creates_opportunity(
    client: AsyncClient, admin_token_a: str
) -> None:
    # 1. Create a lead
    lead_res = await client.post(
        LEADS,
        headers=auth(admin_token_a),
        json={"first_name": "Kelly", "last_name": "Kapoor", "company_name": "Customer Support Inc"},
    )
    assert lead_res.status_code == 201
    lead_id = lead_res.json()["id"]

    # 2. Convert with opportunity_name
    conv_res = await client.post(
        f"{LEADS}/{lead_id}/convert",
        headers=auth(admin_token_a),
        json={
            "create_account": True,
            "opportunity_name": "CS Inc Annual Subscription",
        },
    )
    assert conv_res.status_code == 200
    conv_data = conv_res.json()
    opp_id = conv_data["opportunity_id"]
    assert opp_id is not None

    # 3. Verify opportunity exists and links to lead
    opp_res = await client.get(f"{OPPORTUNITIES}/{opp_id}", headers=auth(admin_token_a))
    assert opp_res.status_code == 200
    opp = opp_res.json()
    assert opp["name"] == "CS Inc Annual Subscription"
    assert opp["lead_id"] == lead_id
    assert opp["account_id"] == conv_data["account_id"]


@pytest.mark.asyncio
async def test_stage_with_opportunity_cannot_be_deleted(
    client: AsyncClient, admin_token_a: str
) -> None:
    pipe_res = await client.get(f"{PIPELINES}/default", headers=auth(admin_token_a))
    pipeline_id = pipe_res.json()["id"]
    stages = pipe_res.json()["stages"]
    qual_stage = next(s for s in stages if s["name"] == "Qualification")

    # Create opp in Qualification stage
    await client.post(
        OPPORTUNITIES,
        headers=auth(admin_token_a),
        json={"name": "Stage Blocker Deal", "amount": "15000.00", "stage_id": qual_stage["id"]},
    )

    # Attempting to delete the stage should return 409 Conflict
    del_res = await client.delete(
        f"{PIPELINES}/{pipeline_id}/stages/{qual_stage['id']}",
        headers=auth(admin_token_a),
    )
    assert del_res.status_code == 409


@pytest.mark.asyncio
async def test_tenant_isolation_opportunities(
    client: AsyncClient, admin_token_a: str, admin_token_b: str
) -> None:
    create_res = await client.post(
        OPPORTUNITIES,
        headers=auth(admin_token_a),
        json={"name": "Tenant A Deal", "amount": "10000.00"},
    )
    opp_a_id = create_res.json()["id"]

    # Tenant B cannot access Tenant A's opportunity
    get_res = await client.get(f"{OPPORTUNITIES}/{opp_a_id}", headers=auth(admin_token_b))
    assert get_res.status_code in (403, 404)

    # Tenant B cannot update Tenant A's opportunity
    patch_res = await client.patch(
        f"{OPPORTUNITIES}/{opp_a_id}",
        headers=auth(admin_token_b),
        json={"name": "Hacked Deal"},
    )
    assert patch_res.status_code in (403, 404)
