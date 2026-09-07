"""Sprint 4: contacts table.

Revision ID: 0005_contacts_table
Revises: 0004_accounts_table
Create Date: 2026-09-07
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_contacts_table"
down_revision: str | None = "0004_accounts_table"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("title", sa.String(length=100), nullable=True),
        sa.Column("account_id", sa.Uuid(), nullable=True),
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
            ["account_id"],
            ["accounts.id"],
            name=op.f("fk_contacts_account_id_accounts"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_contacts_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["tenants.id"],
            name=op.f("fk_contacts_tenant_id_tenants"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_contacts")),
    )
    op.create_index(op.f("ix_contacts_id"), "contacts", ["id"], unique=False)
    op.create_index(op.f("ix_contacts_tenant_id"), "contacts", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_contacts_last_name"), "contacts", ["last_name"], unique=False)
    op.create_index(op.f("ix_contacts_email"), "contacts", ["email"], unique=False)
    op.create_index(op.f("ix_contacts_account_id"), "contacts", ["account_id"], unique=False)
    op.create_index(op.f("ix_contacts_owner_id"), "contacts", ["owner_id"], unique=False)
    op.create_index(
        op.f("ix_contacts_tenant_id_email"),
        "contacts",
        ["tenant_id", "email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contacts_tenant_id_account_id"),
        "contacts",
        ["tenant_id", "account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_contacts_tenant_id_last_name"),
        "contacts",
        ["tenant_id", "last_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_contacts_tenant_id_last_name"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_tenant_id_account_id"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_tenant_id_email"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_owner_id"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_account_id"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_email"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_last_name"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_tenant_id"), table_name="contacts")
    op.drop_index(op.f("ix_contacts_id"), table_name="contacts")
    op.drop_table("contacts")
