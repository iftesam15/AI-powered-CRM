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

        # 3. Check or create demo accounts (Sprint 3)
        from crm.modules.accounts.models import Account
        from crm.modules.accounts.repository import AccountRepository

        account_repo = AccountRepository(session)
        admin_user = await user_repo.get_by_email_and_tenant("admin@calderfreight.test", tenant.id)
        admin_id = admin_user.id if admin_user else None

        accounts_to_seed = [
            {
                "name": "Acme Logistics Corp",
                "industry": "Logistics & Supply Chain",
                "size": "500+",
                "website": "https://acmelogistics.example.com",
                "address": "100 Supply Chain Way, Chicago, IL 60601",
            },
            {
                "name": "Apex Global Freight",
                "industry": "Freight Forwarding",
                "size": "201-500",
                "website": "https://apexglobal.example.com",
                "address": "45 Ocean Port Blvd, Seattle, WA 98101",
            },
            {
                "name": "Starlight Maritime",
                "industry": "Maritime Shipping",
                "size": "51-200",
                "website": "https://starlightmaritime.example.com",
                "address": "88 Harbor Drive, Miami, FL 33101",
            },
            {
                "name": "Summit Retail Distribution",
                "industry": "Retail & E-commerce",
                "size": "500+",
                "website": "https://summitretail.example.com",
                "address": "500 Commerce Ave, Dallas, TX 75201",
            },
            {
                "name": "Vantage Tech Solutions",
                "industry": "Technology & Software",
                "size": "11-50",
                "website": "https://vantagetech.example.com",
                "address": "12 Tech Park Loop, Austin, TX 78701",
            },
        ]

        for acc_data in accounts_to_seed:
            existing_acc = await account_repo.get_by_name(tenant.id, acc_data["name"])
            if not existing_acc:
                print(f"Creating account '{acc_data['name']}'...")
                new_acc = Account(
                    tenant_id=tenant.id,
                    name=acc_data["name"],
                    industry=acc_data["industry"],
                    size=acc_data["size"],
                    website=acc_data["website"],
                    address=acc_data["address"],
                    owner_id=admin_id,
                )
                await account_repo.create(new_acc)

        # 4. Check or create demo contacts (Sprint 4)
        from crm.modules.contacts.models import Contact
        from crm.modules.contacts.repository import ContactRepository

        contact_repo = ContactRepository(session)
        acme_acc = await account_repo.get_by_name(tenant.id, "Acme Logistics Corp")
        apex_acc = await account_repo.get_by_name(tenant.id, "Apex Global Freight")

        contacts_to_seed = [
            {
                "first_name": "Jane",
                "last_name": "Doe",
                "email": "jane.doe@acmelogistics.example.com",
                "phone": "+1 (555) 019-2834",
                "title": "VP of Logistics",
                "account_id": acme_acc.id if acme_acc else None,
            },
            {
                "first_name": "Robert",
                "last_name": "Smith",
                "email": "r.smith@acmelogistics.example.com",
                "phone": "+1 (555) 019-8273",
                "title": "Supply Chain Director",
                "account_id": acme_acc.id if acme_acc else None,
            },
            {
                "first_name": "Alice",
                "last_name": "Johnson",
                "email": "ajohnson@apexglobal.example.com",
                "phone": "+1 (555) 019-3746",
                "title": "Head of Procurement",
                "account_id": apex_acc.id if apex_acc else None,
            },
        ]

        for c_data in contacts_to_seed:
            matches = await contact_repo.find_by_email(tenant.id, c_data["email"])
            if not matches:
                print(f"Creating contact '{c_data['first_name']} {c_data['last_name']}'...")
                new_c = Contact(
                    tenant_id=tenant.id,
                    first_name=c_data["first_name"],
                    last_name=c_data["last_name"],
                    email=c_data["email"],
                    phone=c_data["phone"],
                    title=c_data["title"],
                    account_id=c_data["account_id"],
                    owner_id=admin_id,
                )
                await contact_repo.create(new_c)

        await session.commit()
        print("Database seeding completed successfully.")
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
