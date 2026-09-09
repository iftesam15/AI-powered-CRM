"""Sprint 7: pipelines, pipeline_stages, opportunities, opportunity_stage_history.

Revision ID: 0008_pipelines_and_opportunities
Revises: 0007_leads_table
Create Date: 2026-09-09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008_pipelines_and_opportunities"
down_revision: str | None = "0007_leads_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Pipelines
    op.create_table(
        "pipelines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="true", nullable=False),
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
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_pipelines_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pipelines")),
    )
    op.create_index(op.f("ix_pipelines_id"), "pipelines", ["id"], unique=False)
    op.create_index(op.f("ix_pipelines_tenant_id"), "pipelines", ["tenant_id"], unique=False)
    op.create_index(
        op.f("ix_pipelines_tenant_id_is_default"),
        "pipelines",
        ["tenant_id", "is_default"],
        unique=False,
    )

    # 2. Pipeline Stages
    op.create_table(
        "pipeline_stages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("pipeline_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.Column("probability", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_won", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_lost", sa.Boolean(), server_default="false", nullable=False),
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
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_pipeline_stages_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["pipeline_id"],
            ["pipelines.id"],
            name=op.f("fk_pipeline_stages_pipeline_id_pipelines"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_pipeline_stages")),
    )
    op.create_index(op.f("ix_pipeline_stages_id"), "pipeline_stages", ["id"], unique=False)
    op.create_index(op.f("ix_pipeline_stages_tenant_id"), "pipeline_stages", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_pipeline_stages_pipeline_id"), "pipeline_stages", ["pipeline_id"], unique=False)
    op.create_index(
        op.f("ix_pipeline_stages_pipeline_id_order"),
        "pipeline_stages",
        ["pipeline_id", "display_order"],
        unique=False,
    )

    # 3. Opportunities
    op.create_table(
        "opportunities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Numeric(precision=14, scale=2), server_default="0.00", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("pipeline_id", sa.Uuid(), nullable=False),
        sa.Column("stage_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("primary_contact_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("expected_close_date", sa.Date(), nullable=True),
        sa.Column("probability", sa.Integer(), server_default="0", nullable=False),
        sa.Column("status", sa.String(length=50), server_default="open", nullable=False),
        sa.Column("loss_reason", sa.String(length=500), nullable=True),
        sa.Column("won_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.String(length=2000), nullable=True),
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
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_opportunities_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["pipeline_id"],
            ["pipelines.id"],
            name=op.f("fk_opportunities_pipeline_id_pipelines"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["stage_id"],
            ["pipeline_stages.id"],
            name=op.f("fk_opportunities_stage_id_pipeline_stages"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["accounts.id"],
            name=op.f("fk_opportunities_account_id_accounts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["primary_contact_id"],
            ["contacts.id"],
            name=op.f("fk_opportunities_primary_contact_id_contacts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_opportunities_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["lead_id"],
            ["leads.id"],
            name=op.f("fk_opportunities_lead_id_leads"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_opportunities")),
    )
    op.create_index(op.f("ix_opportunities_id"), "opportunities", ["id"], unique=False)
    op.create_index(op.f("ix_opportunities_tenant_id"), "opportunities", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_opportunities_pipeline_id"), "opportunities", ["pipeline_id"], unique=False)
    op.create_index(op.f("ix_opportunities_stage_id"), "opportunities", ["stage_id"], unique=False)
    op.create_index(op.f("ix_opportunities_account_id"), "opportunities", ["account_id"], unique=False)
    op.create_index(op.f("ix_opportunities_owner_id"), "opportunities", ["owner_id"], unique=False)
    op.create_index(op.f("ix_opportunities_status"), "opportunities", ["status"], unique=False)
    op.create_index(
        op.f("ix_opportunities_tenant_id_status"),
        "opportunities",
        ["tenant_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_opportunities_tenant_id_stage_id"),
        "opportunities",
        ["tenant_id", "stage_id"],
        unique=False,
    )

    # 4. Opportunity Stage History
    op.create_table(
        "opportunity_stage_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("opportunity_id", sa.Uuid(), nullable=False),
        sa.Column("from_stage_id", sa.Uuid(), nullable=True),
        sa.Column("to_stage_id", sa.Uuid(), nullable=False),
        sa.Column("changed_by_id", sa.Uuid(), nullable=True),
        sa.Column("days_in_stage", sa.Integer(), nullable=True),
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
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_opportunity_stage_history_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["opportunity_id"],
            ["opportunities.id"],
            name=op.f("fk_opportunity_stage_history_opportunity_id_opportunities"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["from_stage_id"],
            ["pipeline_stages.id"],
            name=op.f("fk_opportunity_stage_history_from_stage_id_pipeline_stages"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["to_stage_id"],
            ["pipeline_stages.id"],
            name=op.f("fk_opportunity_stage_history_to_stage_id_pipeline_stages"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["changed_by_id"],
            ["users.id"],
            name=op.f("fk_opportunity_stage_history_changed_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_opportunity_stage_history")),
    )
    op.create_index(op.f("ix_opportunity_stage_history_id"), "opportunity_stage_history", ["id"], unique=False)
    op.create_index(op.f("ix_opportunity_stage_history_tenant_id"), "opportunity_stage_history", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_opportunity_stage_history_opportunity_id"), "opportunity_stage_history", ["opportunity_id"], unique=False)

    # 5. Connect leads.converted_opportunity_id foreign key constraint
    op.create_foreign_key(
        op.f("fk_leads_converted_opportunity_id_opportunities"),
        "leads",
        "opportunities",
        ["converted_opportunity_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        op.f("fk_leads_converted_opportunity_id_opportunities"),
        "leads",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_opportunity_stage_history_opportunity_id"), table_name="opportunity_stage_history")
    op.drop_index(op.f("ix_opportunity_stage_history_tenant_id"), table_name="opportunity_stage_history")
    op.drop_index(op.f("ix_opportunity_stage_history_id"), table_name="opportunity_stage_history")
    op.drop_table("opportunity_stage_history")

    op.drop_index(op.f("ix_opportunities_tenant_id_stage_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_tenant_id_status"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_status"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_owner_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_account_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_stage_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_pipeline_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_tenant_id"), table_name="opportunities")
    op.drop_index(op.f("ix_opportunities_id"), table_name="opportunities")
    op.drop_table("opportunities")

    op.drop_index(op.f("ix_pipeline_stages_pipeline_id_order"), table_name="pipeline_stages")
    op.drop_index(op.f("ix_pipeline_stages_pipeline_id"), table_name="pipeline_stages")
    op.drop_index(op.f("ix_pipeline_stages_tenant_id"), table_name="pipeline_stages")
    op.drop_index(op.f("ix_pipeline_stages_id"), table_name="pipeline_stages")
    op.drop_table("pipeline_stages")

    op.drop_index(op.f("ix_pipelines_tenant_id_is_default"), table_name="pipelines")
    op.drop_index(op.f("ix_pipelines_tenant_id"), table_name="pipelines")
    op.drop_index(op.f("ix_pipelines_id"), table_name="pipelines")
    op.drop_table("pipelines")
