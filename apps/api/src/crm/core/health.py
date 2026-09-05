"""Liveness and readiness endpoints.

Health is infrastructure, not a bounded context, so it lives in `core` and is
mounted at the root rather than under the versioned business prefix.

  /health  liveness  - the process is up. Never touches the database, so a
                       database outage does not get the container killed.
  /ready   readiness - dependencies answered, so it is safe to send traffic.
"""

import logging
from typing import Any, Literal

from fastapi import APIRouter, Response, status
from pydantic import BaseModel
from sqlalchemy import text

from crm import __version__
from crm.core.config import settings
from crm.core.database import SessionFactory

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    environment: str


class DependencyStatus(BaseModel):
    status: Literal["ok", "error"]
    detail: str | None = None


class ReadyResponse(BaseModel):
    status: Literal["ready", "degraded"]
    checks: dict[str, DependencyStatus]


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=__version__,
        environment=settings.environment,
    )


async def _check_database() -> DependencyStatus:
    try:
        async with SessionFactory() as session:
            await session.execute(text("SELECT 1"))
        return DependencyStatus(status="ok")
    except Exception as exc:  # noqa: BLE001 - readiness reports, it does not raise
        logger.warning("readiness: database check failed: %s", exc)
        return DependencyStatus(status="error", detail=type(exc).__name__)


@router.get("/ready", response_model=ReadyResponse, summary="Readiness probe")
async def ready(response: Response) -> ReadyResponse:
    checks: dict[str, DependencyStatus] = {"database": await _check_database()}

    healthy = all(check.status == "ok" for check in checks.values())
    if not healthy:
        # 503 so a load balancer stops routing here instead of sending traffic
        # to a replica that cannot serve it.
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadyResponse(status="ready" if healthy else "degraded", checks=checks)


def openapi_health_tags() -> list[dict[str, Any]]:
    return [{"name": "health", "description": "Liveness and readiness probes."}]
