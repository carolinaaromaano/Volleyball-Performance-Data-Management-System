"""match substitutions

Revision ID: 0008_match_substitutions
Revises: 0007_match_point_index_nullable
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0008_match_substitutions"
down_revision = "0007_match_point_index_nullable"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "match_point_events", sa.Column("player_in_number", sa.Integer(), nullable=True)
    )
    op.add_column(
        "match_point_events", sa.Column("player_out_number", sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("match_point_events", "player_out_number")
    op.drop_column("match_point_events", "player_in_number")

