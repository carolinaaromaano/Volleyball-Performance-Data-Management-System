"""make match_point_events.point_index nullable

Revision ID: 0007_match_point_index_nullable
Revises: 0006_sets_for_match_events
Create Date: 2026-04-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0007_match_point_index_nullable"
down_revision: Union[str, None] = "0006_sets_for_match_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    cols = {c["name"] for c in insp.get_columns("match_point_events")}
    if "point_index" in cols:
        op.alter_column(
            "match_point_events",
            "point_index",
            existing_type=sa.Integer(),
            nullable=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    cols = {c["name"] for c in insp.get_columns("match_point_events")}
    if "point_index" in cols:
        op.alter_column(
            "match_point_events",
            "point_index",
            existing_type=sa.Integer(),
            nullable=False,
        )

