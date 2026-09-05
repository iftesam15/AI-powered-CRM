"""FastAPI application factory.

`create_app()` rather than a module-level `app` so tests can build an isolated
instance, and so settings are resolved at call time instead of import time.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from crm import __version__
from crm.core.config import settings
from crm.core.database import engine
from crm.core.exceptions import register_exception_handlers
from crm.core.health import router as health_router
from crm.core.logging import configure_logging
from crm.core.middleware import RequestContextMiddleware
from crm.modules.accounts.router import router as accounts_router
from crm.modules.audit.router import router as audit_router
from crm.modules.auth.router import router as auth_router
from crm.modules.users.router import router as users_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("starting %s v%s (env=%s)", settings.app_name, __version__, settings.environment)
    yield
    # Return pooled connections on shutdown so a rolling deploy does not leave
    # sockets open against Postgres.
    await engine.dispose()
    logger.info("shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Multi-tenant B2B CRM API. Every business route is scoped to the "
            "tenant on the authenticated session; the client never selects a tenant."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=[
            {"name": "health", "description": "Liveness and readiness probes."},
            {
                "name": "auth",
                "description": "Authentication, token refresh, and password recovery.",
            },
            {
                "name": "users",
                "description": (
                    "User administration: create, list, assign roles, "
                    "activate and deactivate. Scoped to the caller's tenant."
                ),
            },
            {
                "name": "audit",
                "description": "Append-only trail of security and data-changing actions.",
            },
            {"name": "accounts", "description": "Company accounts management."},
        ],
    )

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    register_exception_handlers(app)

    # Infrastructure probes sit at the root, outside the versioned surface.
    app.include_router(health_router)

    # Business routers mount under /api/v1
    v1 = APIRouter(prefix=settings.api_v1_prefix)
    v1.include_router(auth_router)
    v1.include_router(users_router)
    v1.include_router(audit_router)
    v1.include_router(accounts_router)
    app.include_router(v1)

    return app


app = create_app()
