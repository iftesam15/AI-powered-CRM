"""Seed database with default local demonstration tenant and users."""

import asyncio

from crm.core.database import SessionFactory, engine
from crm.modules.tenants.models import Tenant
from crm.modules.tenants.repository import TenantRepository
from crm.modules.tenants.schemas import TenantCreate
from crm.modules.tenants.service import TenantService
from crm.modules.users.models import User
from crm.modules.users.repository import UserRepository
from crm.modules.users.schemas import UserCreate
from crm.modules.users.service import UserService


async def seed() -> None:
    async with SessionFactory() as session:
        tenant_repo = TenantRepository(session)
        user_repo = UserRepository(session)
        tenant_service = TenantService(session)
        user_service = UserService(session)

        # 1. Check or create demo tenant
        tenant_slug = "calder-freightways"
        tenant: Tenant | None = await tenant_repo.get_by_slug(tenant_slug)
        if not tenant:
            print("Creating demo tenant 'Calder Freightways'...")
            tenant = await tenant_service.create_tenant(
                TenantCreate(
                    name="Calder Freightways",
                    slug=tenant_slug,
                    default_currency="USD",
                    locale="en-US",
                )
            )
        else:
            print(f"Demo tenant '{tenant.name}' already exists.")

        # 2. Check or create demo users
        users_to_seed = [
            {
                "email": "admin@calderfreight.test",
                "password": "Sprint1demo!",
                "full_name": "Admin User",
                "role": "admin",
            },
            {
                "email": "rep@calderfreight.test",
                "password": "Sprint1demo!",
                "full_name": "Sales Rep User",
                "role": "sales_rep",
            },
            # Sprint 2: one account per role, so /settings/users demonstrates
            # all four levels of access rather than just two.
            {
                "email": "manager@calderfreight.test",
                "password": "Sprint1demo!",
                "full_name": "Sales Manager User",
                "role": "sales_manager",
            },
            {
                "email": "finance@calderfreight.test",
                "password": "Sprint1demo!",
                "full_name": "Read Only User",
                "role": "read_only",
            },
        ]

        for user_data in users_to_seed:
            existing: User | None = await user_repo.get_by_email_and_tenant(
                user_data["email"], tenant.id
            )
            if not existing:
                print(f"Creating user '{user_data['email']}' ({user_data['role']})...")
                await user_service.create_user(
                    UserCreate(
                        tenant_id=tenant.id,
                        email=user_data["email"],
                        password=user_data["password"],
                        full_name=user_data["full_name"],
                        role=user_data["role"],
                    )
                )
            else:
                print(f"User '{user_data['email']}' already exists.")

        await session.commit()
        print("Database seeding completed successfully.")
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
