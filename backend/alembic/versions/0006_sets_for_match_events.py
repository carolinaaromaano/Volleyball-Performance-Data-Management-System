"""sets for match events

Revision ID: 0006_sets_for_match_events
Revises: 0005_match_point_by_point
Create Date: 2026-04-26
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0006_sets_for_match_events"
down_revision: Union[str, None] = "0005_match_point_by_point"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    lineup_cols = {c["name"] for c in insp.get_columns("match_lineups")}
    if "set_number" not in lineup_cols:
        op.add_column(
            "match_lineups",
            sa.Column("set_number", sa.Integer(), nullable=False, server_default="1"),
        )
        op.execute(sa.text("UPDATE match_lineups SET set_number = 1 WHERE set_number IS NULL"))

    event_cols = {c["name"] for c in insp.get_columns("match_point_events")}
    if "set_number" not in event_cols:
        op.add_column(
            "match_point_events",
            sa.Column("set_number", sa.Integer(), nullable=False, server_default="1"),
        )
        op.execute(sa.text("UPDATE match_point_events SET set_number = 1 WHERE set_number IS NULL"))

    if "rally_index" not in event_cols:
        op.add_column(
            "match_point_events",
            sa.Column("rally_index", sa.Integer(), nullable=True),
        )
        if "point_index" in event_cols:
            op.execute(sa.text("UPDATE match_point_events SET rally_index = point_index WHERE rally_index IS NULL"))
        op.execute(sa.text("UPDATE match_point_events SET rally_index = 1 WHERE rally_index IS NULL"))
        op.alter_column("match_point_events", "rally_index", existing_type=sa.Integer(), nullable=False)

    existing_indexes = {ix.get("name") for ix in insp.get_indexes("match_point_events")}
    if "ix_match_point_events_set_number" not in existing_indexes:
        op.create_index(
            "ix_match_point_events_set_number",
            "match_point_events",
            ["set_number"],
        )
    if "ix_match_point_events_rally_index" not in existing_indexes:
        op.create_index(
            "ix_match_point_events_rally_index",
            "match_point_events",
            ["rally_index"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    event_cols = {c["name"] for c in insp.get_columns("match_point_events")}
    if "rally_index" in event_cols:
        try:
            op.drop_index("ix_match_point_events_rally_index", table_name="match_point_events")
        except Exception:
            pass
        op.drop_column("match_point_events", "rally_index")
    if "set_number" in event_cols:
        try:
            op.drop_index("ix_match_point_events_set_number", table_name="match_point_events")
        except Exception:
            pass
        op.drop_column("match_point_events", "set_number")

    lineup_cols = {c["name"] for c in insp.get_columns("match_lineups")}
    if "set_number" in lineup_cols:
        op.drop_column("match_lineups", "set_number")

