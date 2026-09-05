"""Shared test fixtures for database, app, and multi-tenant authentication."""

from collections.abc import AsyncGenerator, AsyncIterator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from crm.core.database import Base, get_db
from crm.core.security import create_access_token, hash_password
from crm.integrations.mail import get_mail_sender
from crm.integrations.mail.console import ConsoleMailSender
from crm.main import create_app
from crm.modules.tenants.models import Tenant
from crm.modules.users.models import User


@pytest.fixture(scope="session")
def engine() -> AsyncEngine:
    return create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)


@pytest.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated database session with created schema per test."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with session_factory() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
def test_mail_sender() -> ConsoleMailSender:
    return ConsoleMailSender()


@pytest.fixture
def app(db_session: AsyncSession, test_mail_sender: ConsoleMailSender) -> FastAPI:
    """Create test FastAPI application with overridden dependencies."""
    application = create_app()

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    application.dependency_overrides[get_db] = _override_get_db
    application.dependency_overrides[get_mail_sender] = lambda: test_mail_sender
    return application


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """Drives the app in-process."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def tenant_a(db_session: AsyncSession) -> Tenant:
    tenant = Tenant(
        name="Tenant Alpha",
        slug="tenant-alpha",
        default_currency="USD",
        locale="en-US",
        is_active=True,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest.fixture
async def tenant_b(db_session: AsyncSession) -> Tenant:
    tenant = Tenant(
        name="Tenant Beta",
        slug="tenant-beta",
        default_currency="EUR",
        locale="de-DE",
        is_active=True,
    )
    db_session.add(tenant)
    await db_session.commit()
    await db_session.refresh(tenant)
    return tenant


@pytest.fixture
async def admin_user_a(db_session: AsyncSession, tenant_a: Tenant) -> User:
    user = User(
        tenant_id=tenant_a.id,
        email="admin@alpha.test",
        hashed_password=hash_password("Sprint1demo!"),
        full_name="Alpha Admin",
        role="admin",
        is_active=True,
        failed_login_attempts=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def rep_user_a(db_session: AsyncSession, tenant_a: Tenant) -> User:
    user = User(
        tenant_id=tenant_a.id,
        email="rep@alpha.test",
        hashed_password=hash_password("Sprint1demo!"),
        full_name="Alpha Rep",
        role="sales_rep",
        is_active=True,
        failed_login_attempts=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def manager_user_a(db_session: AsyncSession, tenant_a: Tenant) -> User:
    user = User(
        tenant_id=tenant_a.id,
        email="manager@alpha.test",
        hashed_password=hash_password("Sprint1demo!"),
        full_name="Alpha Manager",
        role="sales_manager",
        is_active=True,
        failed_login_attempts=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def readonly_user_a(db_session: AsyncSession, tenant_a: Tenant) -> User:
    user = User(
        tenant_id=tenant_a.id,
        email="viewer@alpha.test",
        hashed_password=hash_password("Sprint1demo!"),
        full_name="Alpha Viewer",
        role="read_only",
        is_active=True,
        failed_login_attempts=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_user_b(db_session: AsyncSession, tenant_b: Tenant) -> User:
    user = User(
        tenant_id=tenant_b.id,
        email="admin@beta.test",
        hashed_password=hash_password("Sprint1demo!"),
        full_name="Beta Admin",
        role="admin",
        is_active=True,
        failed_login_attempts=0,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
def admin_token_a(admin_user_a: User) -> str:
    return create_access_token(admin_user_a.id, admin_user_a.tenant_id, admin_user_a.role)


@pytest.fixture
def rep_token_a(rep_user_a: User) -> str:
    return create_access_token(rep_user_a.id, rep_user_a.tenant_id, rep_user_a.role)


@pytest.fixture
def admin_token_b(admin_user_b: User) -> str:
    return create_access_token(admin_user_b.id, admin_user_b.tenant_id, admin_user_b.role)


@pytest.fixture
def manager_token_a(manager_user_a: User) -> str:
    return create_access_token(
        manager_user_a.id, manager_user_a.tenant_id, manager_user_a.role
    )


@pytest.fixture
def readonly_token_a(readonly_user_a: User) -> str:
    return create_access_token(
        readonly_user_a.id, readonly_user_a.tenant_id, readonly_user_a.role
    )


def auth(token: str) -> dict[str, str]:
    """Bearer header for a token fixture, so tests read as one line."""
    return {"Authorization": f"Bearer {token}"}
