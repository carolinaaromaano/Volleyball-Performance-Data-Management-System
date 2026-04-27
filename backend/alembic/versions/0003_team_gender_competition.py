"""team gender and competition level

Revision ID: 0003_team_gender_competition
Revises: 0002_coach_stats
Create Date: 2026-04-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0003_team_gender_competition"
down_revision: Union[str, None] = "0002_coach_stats"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS gender VARCHAR")
        )
        op.execute(
            sa.text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS competition VARCHAR")
        )
    else:
        op.add_column("teams", sa.Column("gender", sa.String(), nullable=True))
        op.add_column("teams", sa.Column("competition", sa.String(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE teams DROP COLUMN IF EXISTS competition"))
        op.execute(sa.text("ALTER TABLE teams DROP COLUMN IF EXISTS gender"))
    else:
        op.drop_column("teams", "competition")
        op.drop_column("teams", "gender")
