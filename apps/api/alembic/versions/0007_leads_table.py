"""Sprint 6: leads table.

Revision ID: 0007_leads_table
Revises: 0006_activities_and_tasks
Create Date: 2026-09-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_leads_table"
down_revision: str | None = "0006_activities_and_tasks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("company_name", sa.String(length=255), nullable=True),
        sa.Column("title", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="new", nullable=False),
        sa.Column("source", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.String(length=1000), nullable=True),
        sa.Column("is_converted", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("converted_contact_id", sa.Uuid(), nullable=True),
        sa.Column("converted_account_id", sa.Uuid(), nullable=True),
        sa.Column("converted_opportunity_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["converted_contact_id"],
            ["contacts.id"],
            name=op.f("fk_leads_converted_contact_id_contacts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["converted_account_id"],
            ["accounts.id"],
            name=op.f("fk_leads_converted_account_id_accounts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_leads_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_leads_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leads")),
    )
    op.create_index(op.f("ix_leads_id"), "leads", ["id"], unique=False)
    op.create_index(op.f("ix_leads_tenant_id"), "leads", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_leads_last_name"), "leads", ["last_name"], unique=False)
    op.create_index(op.f("ix_leads_email"), "leads", ["email"], unique=False)
    op.create_index(op.f("ix_leads_status"), "leads", ["status"], unique=False)
    op.create_index(op.f("ix_leads_is_converted"), "leads", ["is_converted"], unique=False)
    op.create_index(op.f("ix_leads_converted_contact_id"), "leads", ["converted_contact_id"], unique=False)
    op.create_index(op.f("ix_leads_converted_account_id"), "leads", ["converted_account_id"], unique=False)
    op.create_index(op.f("ix_leads_owner_id"), "leads", ["owner_id"], unique=False)

    op.create_index(
        op.f("ix_leads_tenant_id_status"),
        "leads",
        ["tenant_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_leads_tenant_id_email"),
        "leads",
        ["tenant_id", "email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_leads_tenant_id_last_name"),
        "leads",
        ["tenant_id", "last_name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_leads_tenant_id_is_converted"),
        "leads",
        ["tenant_id", "is_converted"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_tenant_id_is_converted"), table_name="leads")
    op.drop_index(op.f("ix_leads_tenant_id_last_name"), table_name="leads")
    op.drop_index(op.f("ix_leads_tenant_id_email"), table_name="leads")
    op.drop_index(op.f("ix_leads_tenant_id_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_owner_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_converted_account_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_converted_contact_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_is_converted"), table_name="leads")
    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_email"), table_name="leads")
    op.drop_index(op.f("ix_leads_last_name"), table_name="leads")
    op.drop_index(op.f("ix_leads_tenant_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_id"), table_name="leads")
    op.drop_table("leads")
