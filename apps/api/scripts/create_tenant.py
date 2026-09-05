"""Bootstrap a new tenant and initial administrator user."""

import argparse
import asyncio
import sys

from crm.core.database import SessionFactory, engine
from crm.core.exceptions import ConflictError
from crm.modules.tenants.schemas import TenantCreate
from crm.modules.tenants.service import TenantService
from crm.modules.users.schemas import UserCreate
from crm.modules.users.service import UserService


async def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap a new CRM tenant and admin user.")
    parser.add_argument("--name", required=True, help="Tenant name (e.g., 'Calder Freightways')")
    parser.add_argument("--slug", help="Tenant URL slug (optional, auto-generated if omitted)")
    parser.add_argument("--currency", default="USD", help="Tenant default currency (default: USD)")
    parser.add_argument("--locale", default="en-US", help="Tenant locale (default: en-US)")
    parser.add_argument("--admin-email", required=True, help="Administrator email address")
    parser.add_argument("--admin-name", default="Administrator", help="Administrator full name")
    parser.add_argument("--password", required=True, help="Administrator password (min 8 chars)")

    args = parser.parse_args()

    async with SessionFactory() as session:
        tenant_service = TenantService(session)
        user_service = UserService(session)

        try:
            print(f"Creating tenant '{args.name}'...")
            tenant = await tenant_service.create_tenant(
                TenantCreate(
                    name=args.name,
                    slug=args.slug,
                    default_currency=args.currency,
                    locale=args.locale,
                )
            )
            print(f"  Tenant created: ID={tenant.id}, Slug={tenant.slug}")

            print(f"Creating admin user '{args.admin_email}'...")
            admin = await user_service.create_user(
                UserCreate(
                    tenant_id=tenant.id,
                    email=args.admin_email,
                    full_name=args.admin_name,
                    password=args.password,
                    role="admin",
                )
            )
            await session.commit()
            print(f"  Admin user created: ID={admin.id}, Email={admin.email}, Role={admin.role}")
            print("\nTenant bootstrap completed successfully.")
        except ConflictError as exc:
            print(f"Error: {exc.detail}", file=sys.stderr)
            sys.exit(1)
        finally:
            await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
