"""Sprint 3: accounts table.

Revision ID: 0004_accounts_table
Revises: 0003_audit_logs
Create Date: 2026-09-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_accounts_table"
down_revision: str | None = "0003_audit_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("industry", sa.String(length=100), nullable=True),
        sa.Column("size", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
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
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_accounts_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_accounts_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_accounts")),
        sa.UniqueConstraint("tenant_id", "name", name=op.f("uq_accounts_tenant_name")),
    )
    op.create_index(op.f("ix_accounts_id"), "accounts", ["id"], unique=False)
    op.create_index(op.f("ix_accounts_tenant_id"), "accounts", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_accounts_name"), "accounts", ["name"], unique=False)
    op.create_index(op.f("ix_accounts_owner_id"), "accounts", ["owner_id"], unique=False)
    op.create_index(
        op.f("ix_accounts_tenant_id_name"),
        "accounts",
        ["tenant_id", "name"],
        unique=False,
    )
    op.create_index(
        op.f("ix_accounts_tenant_id_industry"),
        "accounts",
        ["tenant_id", "industry"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_accounts_tenant_id_industry"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_tenant_id_name"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_owner_id"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_name"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_tenant_id"), table_name="accounts")
    op.drop_index(op.f("ix_accounts_id"), table_name="accounts")
    op.drop_table("accounts")
