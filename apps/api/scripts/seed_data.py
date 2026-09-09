"""Seed database with default local demonstration tenant and users."""

import asyncio

from crm.core.database import SessionFactory, engine
from crm.modules.accounts.models import Account
from crm.modules.activities.models import Activity
from crm.modules.contacts.models import Contact
from crm.modules.leads.models import Lead
from crm.modules.tasks.models import Task
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

        # 5. Check or create demo activities & tasks (Sprint 5)
        from datetime import datetime, timedelta, timezone
        from crm.modules.activities.models import Activity
        from crm.modules.activities.repository import ActivityRepository
        from crm.modules.tasks.models import Task
        from crm.modules.tasks.repository import TaskRepository

        act_repo = ActivityRepository(session)
        task_repo = TaskRepository(session)

        jane_contact = (await contact_repo.find_by_email(tenant.id, "jane.doe@acmelogistics.example.com"))
        jane = jane_contact[0] if jane_contact else None

        if acme_acc:
            existing_acts, _ = await act_repo.list_activities(tenant.id, entity_type="account", entity_id=acme_acc.id)
            if not existing_acts:
                print("Seeding initial activities for Acme Logistics Corp...")
                now = datetime.now(timezone.utc)
                await act_repo.create(
                    tenant_id=tenant.id,
                    activity_type="call",
                    title="Introductory Discovery Call",
                    description="Discussed Q4 logistics route capacity and software integration requirements.",
                    performed_at=now - timedelta(days=5),
                    entity_type="account",
                    entity_id=acme_acc.id,
                    account_id=acme_acc.id,
                    contact_id=jane.id if jane else None,
                    created_by_id=admin_id,
                )
                await act_repo.create(
                    tenant_id=tenant.id,
                    activity_type="meeting",
                    title="Executive Strategy Briefing",
                    description="Presented proposal for automated dispatch workflows.",
                    performed_at=now - timedelta(days=2),
                    entity_type="account",
                    entity_id=acme_acc.id,
                    account_id=acme_acc.id,
                    contact_id=jane.id if jane else None,
                    created_by_id=admin_id,
                )

            existing_tasks, _ = await task_repo.list_tasks(tenant.id, entity_type="account", entity_id=acme_acc.id)
            if not existing_tasks:
                print("Seeding initial tasks for Acme Logistics Corp...")
                now = datetime.now(timezone.utc)
                await task_repo.create(
                    tenant_id=tenant.id,
                    title="Send SLA & Pricing Proposal",
                    description="Draft custom tier pricing model for 50+ fleet hubs.",
                    status="pending",
                    priority="high",
                    due_date=now + timedelta(days=2),
                    completed_at=None,
                    entity_type="account",
                    entity_id=acme_acc.id,
                    account_id=acme_acc.id,
                    contact_id=jane.id if jane else None,
                    assigned_to_id=admin_id,
                    created_by_id=admin_id,
                )

        # 6. Check or create demo leads (Sprint 6)
        from crm.modules.leads.models import Lead
        from crm.modules.leads.repository import LeadRepository

        lead_repo = LeadRepository(session)
        existing_leads = await lead_repo.list_leads(tenant.id, limit=10)
        if not existing_leads:
            print("Seeding initial leads for Calder Freightways...")
            leads_to_seed = [
                {
                    "first_name": "Michael",
                    "last_name": "Scott",
                    "email": "mscott@dundermifflin.example.com",
                    "phone": "+1 (555) 019-9482",
                    "company_name": "Dunder Mifflin Freight",
                    "title": "Regional Manager",
                    "status": "qualified",
                    "source": "website",
                    "notes": "Expressing urgent interest in regional paper distribution logistics.",
                    "owner_id": admin_id,
                },
                {
                    "first_name": "Dwight",
                    "last_name": "Schrute",
                    "email": "dschrute@beetfarms.example.com",
                    "phone": "+1 (555) 019-2834",
                    "company_name": "Schrute Beet Logistics",
                    "title": "Assistant to Regional Manager",
                    "status": "new",
                    "source": "referral",
                    "notes": "Wants cold-chain beet transport options.",
                    "owner_id": admin_id,
                },
                {
                    "first_name": "Pam",
                    "last_name": "Beesly",
                    "email": "pbeesly@prattart.example.com",
                    "phone": "+1 (555) 019-4829",
                    "company_name": "Pratt Packaging",
                    "title": "Office Administrator",
                    "status": "contacted",
                    "source": "outbound",
                    "notes": "Followed up after trade show inquiry.",
                    "owner_id": admin_id,
                },
            ]
            for l_data in leads_to_seed:
                lead_obj = Lead(
                    tenant_id=tenant.id,
                    first_name=l_data["first_name"],
                    last_name=l_data["last_name"],
                    email=l_data["email"],
                    phone=l_data["phone"],
                    company_name=l_data["company_name"],
                    title=l_data["title"],
                    status=l_data["status"],
                    source=l_data["source"],
                    notes=l_data["notes"],
                    owner_id=l_data["owner_id"],
                )
                await lead_repo.create(lead_obj)

        # 7. Check or create demo pipeline & opportunities (Sprint 7)
        from crm.modules.opportunities.models import Opportunity, OpportunityStageHistory
        from crm.modules.opportunities.repository import OpportunityRepository
        from crm.modules.pipelines.service import PipelineService
        from datetime import date, datetime, timezone
        from decimal import Decimal

        pipe_service = PipelineService(session)
        pipeline = await pipe_service.seed_default_pipeline(tenant.id)
        opp_repo = OpportunityRepository(session)
        existing_opps_count = await opp_repo.count_opportunities(tenant.id)

        if existing_opps_count == 0 and pipeline.stages:
            stages_by_name = {s.name: s for s in pipeline.stages}
            qual_stage = stages_by_name.get("Qualification") or pipeline.stages[0]
            disc_stage = stages_by_name.get("Discovery") or pipeline.stages[1]
            prop_stage = stages_by_name.get("Proposal") or pipeline.stages[2]
            nego_stage = stages_by_name.get("Negotiation") or pipeline.stages[3]
            won_stage = stages_by_name.get("Closed Won") or pipeline.stages[4]
            lost_stage = stages_by_name.get("Closed Lost") or pipeline.stages[5]

            acme_acc = await account_repo.get_by_name(tenant.id, "Acme Logistics Corp")
            apex_acc = await account_repo.get_by_name(tenant.id, "Apex Global Freight")

            demo_opps = [
                {
                    "name": "Midwest Fleet Expansion Deal",
                    "amount": Decimal("45000.00"),
                    "stage": qual_stage,
                    "account_id": acme_acc.id if acme_acc else None,
                    "expected_close_date": date(2026, 10, 15),
                    "probability": qual_stage.probability,
                    "status": "open",
                    "notes": "Initial interest in adding 12 dry van routes.",
                },
                {
                    "name": "Cold-Chain Reefer Fleet Upgrade",
                    "amount": Decimal("82000.00"),
                    "stage": disc_stage,
                    "account_id": apex_acc.id if apex_acc else None,
                    "expected_close_date": date(2026, 11, 1),
                    "probability": disc_stage.probability,
                    "status": "open",
                    "notes": "Technical specs reviewed; temperature-controlled monitoring required.",
                },
                {
                    "name": "Pacific Northwest Regional Contract",
                    "amount": Decimal("120000.00"),
                    "stage": prop_stage,
                    "account_id": acme_acc.id if acme_acc else None,
                    "expected_close_date": date(2026, 10, 30),
                    "probability": prop_stage.probability,
                    "status": "open",
                    "notes": "Formal proposal submitted for 3-year term.",
                },
                {
                    "name": "Enterprise GPS Telematics Rollout",
                    "amount": Decimal("65000.00"),
                    "stage": nego_stage,
                    "account_id": acme_acc.id if acme_acc else None,
                    "expected_close_date": date(2026, 9, 25),
                    "probability": nego_stage.probability,
                    "status": "open",
                    "notes": "Contract final review with legal and operations.",
                },
                {
                    "name": "Q2 Dedicated Lanes Contract",
                    "amount": Decimal("95000.00"),
                    "stage": won_stage,
                    "account_id": apex_acc.id if apex_acc else None,
                    "expected_close_date": date(2026, 8, 30),
                    "probability": 100,
                    "status": "won",
                    "won_at": datetime.now(timezone.utc),
                    "notes": "Signed and executed.",
                },
                {
                    "name": "Spot Brokerage Integration",
                    "amount": Decimal("30000.00"),
                    "stage": lost_stage,
                    "account_id": acme_acc.id if acme_acc else None,
                    "expected_close_date": date(2026, 8, 15),
                    "probability": 0,
                    "status": "lost",
                    "lost_at": datetime.now(timezone.utc),
                    "loss_reason": "Competitor undercut rate by 18% on spot margin.",
                    "notes": "Re-evaluate during annual RFP cycle.",
                },
            ]

            print(f"Seeding {len(demo_opps)} sample opportunities...")
            for opp_data in demo_opps:
                stg = opp_data["stage"]
                opp_record = Opportunity(
                    tenant_id=tenant.id,
                    name=opp_data["name"],
                    amount=opp_data["amount"],
                    currency="USD",
                    pipeline_id=pipeline.id,
                    stage_id=stg.id,
                    account_id=opp_data["account_id"],
                    owner_id=admin_id,
                    expected_close_date=opp_data["expected_close_date"],
                    probability=opp_data["probability"],
                    status=opp_data["status"],
                    loss_reason=opp_data.get("loss_reason"),
                    won_at=opp_data.get("won_at"),
                    lost_at=opp_data.get("lost_at"),
                    notes=opp_data.get("notes"),
                )
                created_opp = await opp_repo.create(opp_record)
                hist = OpportunityStageHistory(
                    tenant_id=tenant.id,
                    opportunity_id=created_opp.id,
                    from_stage_id=None,
                    to_stage_id=stg.id,
                    changed_by_id=admin_id,
                    days_in_stage=0,
                )
                await opp_repo.create_stage_history(hist)

        await session.commit()
        print("Database seeding completed successfully.")
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
