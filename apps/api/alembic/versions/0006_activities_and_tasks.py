"""Sprint 5: activities and tasks tables.

Revision ID: 0006_activities_and_tasks
Revises: 0005_contacts_table
Create Date: 2026-09-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_activities_and_tasks"
down_revision: str | None = "0005_contacts_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Activities table
    op.create_table(
        "activities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("activity_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "performed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=False),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("contact_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
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
            ["account_id"],
            ["accounts.id"],
            name=op.f("fk_activities_account_id_accounts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["contact_id"],
            ["contacts.id"],
            name=op.f("fk_activities_contact_id_contacts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_activities_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_activities_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_activities")),
    )
    op.create_index(op.f("ix_activities_id"), "activities", ["id"], unique=False)
    op.create_index(op.f("ix_activities_tenant_id"), "activities", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_activities_account_id"), "activities", ["account_id"], unique=False)
    op.create_index(op.f("ix_activities_contact_id"), "activities", ["contact_id"], unique=False)
    op.create_index(op.f("ix_activities_created_by_id"), "activities", ["created_by_id"], unique=False)
    op.create_index(
        op.f("ix_activities_tenant_id_entity_type_entity_id"),
        "activities",
        ["tenant_id", "entity_type", "entity_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_activities_tenant_id_performed_at"),
        "activities",
        ["tenant_id", "performed_at"],
        unique=False,
    )

    # 2. Tasks table
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("priority", sa.String(length=50), server_default="medium", nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=True),
        sa.Column("contact_id", sa.Uuid(), nullable=True),
        sa.Column("assigned_to_id", sa.Uuid(), nullable=True),
        sa.Column("created_by_id", sa.Uuid(), nullable=True),
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
            ["account_id"],
            ["accounts.id"],
            name=op.f("fk_tasks_account_id_accounts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["contact_id"],
            ["contacts.id"],
            name=op.f("fk_tasks_contact_id_contacts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_to_id"],
            ["users.id"],
            name=op.f("fk_tasks_assigned_to_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["users.id"],
            name=op.f("fk_tasks_created_by_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_tasks_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(op.f("ix_tasks_id"), "tasks", ["id"], unique=False)
    op.create_index(op.f("ix_tasks_tenant_id"), "tasks", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_tasks_account_id"), "tasks", ["account_id"], unique=False)
    op.create_index(op.f("ix_tasks_contact_id"), "tasks", ["contact_id"], unique=False)
    op.create_index(op.f("ix_tasks_assigned_to_id"), "tasks", ["assigned_to_id"], unique=False)
    op.create_index(op.f("ix_tasks_created_by_id"), "tasks", ["created_by_id"], unique=False)
    op.create_index(
        op.f("ix_tasks_tenant_id_status"),
        "tasks",
        ["tenant_id", "status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tasks_tenant_id_due_date"),
        "tasks",
        ["tenant_id", "due_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_tasks_tenant_id_entity_type_entity_id"),
        "tasks",
        ["tenant_id", "entity_type", "entity_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_tasks_tenant_id_entity_type_entity_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_tenant_id_due_date"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_tenant_id_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_created_by_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_assigned_to_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_contact_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_account_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_tenant_id"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_id"), table_name="tasks")
    op.drop_table("tasks")

    op.drop_index(op.f("ix_activities_tenant_id_performed_at"), table_name="activities")
    op.drop_index(op.f("ix_activities_tenant_id_entity_type_entity_id"), table_name="activities")
    op.drop_index(op.f("ix_activities_created_by_id"), table_name="activities")
    op.drop_index(op.f("ix_activities_contact_id"), table_name="activities")
    op.drop_index(op.f("ix_activities_account_id"), table_name="activities")
    op.drop_index(op.f("ix_activities_tenant_id"), table_name="activities")
    op.drop_index(op.f("ix_activities_id"), table_name="activities")
    op.drop_table("activities")
