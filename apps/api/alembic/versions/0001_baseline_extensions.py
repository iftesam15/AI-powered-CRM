"""Baseline: required PostgreSQL extensions.

No tables yet. Sprint 0 establishes that the migration pipeline runs end to end;
`tenants` and `users` arrive with sprint 1.

The extensions are created here rather than alongside the first index that needs
them, because CREATE EXTENSION requires elevated rights that the application
role will not have in a managed environment. Getting it out of the way in the
baseline keeps later migrations runnable by an ordinary owner.

  pg_trgm    trigram indexes for name and email search (CRM_ARCHITECTURE.md
             section 5, "Email/name search: pg_trgm and/or tsvector")
  citext     case-insensitive text, so tenant-scoped unique email constraints
             do not need a functional index on lower(email)

Revision ID: 0001_baseline
Revises:
Create Date: 2026-09-03
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0001_baseline"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EXTENSIONS = ("pg_trgm", "citext")


def upgrade() -> None:
    for extension in EXTENSIONS:
        op.execute(f'CREATE EXTENSION IF NOT EXISTS "{extension}"')


def downgrade() -> None:
    # Dropped in reverse so a future extension that depends on an earlier one
    # unwinds cleanly.
    for extension in reversed(EXTENSIONS):
        op.execute(f'DROP EXTENSION IF EXISTS "{extension}"')
