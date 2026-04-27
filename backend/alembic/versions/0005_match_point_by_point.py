"""match point-by-point stats

Revision ID: 0005_match_point_by_point
Revises: 0004_session_matches
Create Date: 2026-04-26

Adds:
- match_lineups (starting rotation for both sides)
- match_point_events (point-by-point log)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0005_match_point_by_point"
down_revision: Union[str, None] = "0004_session_matches"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    tables = set(insp.get_table_names())

    if "match_lineups" not in tables:
        op.create_table(
            "match_lineups",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("training_session_id", sa.Integer(), nullable=False),
            sa.Column("side", sa.String(), nullable=False),
            sa.Column("team_name", sa.String(), nullable=True),
            sa.Column("p1", sa.Integer(), nullable=True),
            sa.Column("p2", sa.Integer(), nullable=True),
            sa.Column("p3", sa.Integer(), nullable=True),
            sa.Column("p4", sa.Integer(), nullable=True),
            sa.Column("p5", sa.Integer(), nullable=True),
            sa.Column("p6", sa.Integer(), nullable=True),
            sa.Column("recorded_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_match_lineups_training_session_id",
            "match_lineups",
            ["training_session_id"],
        )
        op.create_foreign_key(
            "fk_match_lineups_training_session_id_sessions",
            "match_lineups",
            "sessions",
            ["training_session_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_match_lineups_recorded_by_user_id_users",
            "match_lineups",
            "users",
            ["recorded_by_user_id"],
            ["id"],
        )

    if "match_point_events" not in tables:
        op.create_table(
            "match_point_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("training_session_id", sa.Integer(), nullable=False),
            sa.Column("point_index", sa.Integer(), nullable=False),
            sa.Column("scoring_side", sa.String(), nullable=False),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("player_number", sa.Integer(), nullable=True),
            sa.Column("recorded_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
        )
        op.create_index(
            "ix_match_point_events_training_session_id",
            "match_point_events",
            ["training_session_id"],
        )
        op.create_index(
            "ix_match_point_events_point_index",
            "match_point_events",
            ["point_index"],
        )
        op.create_foreign_key(
            "fk_match_point_events_training_session_id_sessions",
            "match_point_events",
            "sessions",
            ["training_session_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_match_point_events_recorded_by_user_id_users",
            "match_point_events",
            "users",
            ["recorded_by_user_id"],
            ["id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)
    tables = set(insp.get_table_names())

    if "match_point_events" in tables:
        try:
            op.drop_index("ix_match_point_events_point_index", table_name="match_point_events")
        except Exception:
            pass
        try:
            op.drop_index(
                "ix_match_point_events_training_session_id", table_name="match_point_events"
            )
        except Exception:
            pass
        try:
            op.drop_constraint(
                "fk_match_point_events_recorded_by_user_id_users",
                "match_point_events",
                type_="foreignkey",
            )
        except Exception:
            pass
        try:
            op.drop_constraint(
                "fk_match_point_events_training_session_id_sessions",
                "match_point_events",
                type_="foreignkey",
            )
        except Exception:
            pass
        op.drop_table("match_point_events")

    if "match_lineups" in tables:
        try:
            op.drop_index("ix_match_lineups_training_session_id", table_name="match_lineups")
        except Exception:
            pass
        try:
            op.drop_constraint(
                "fk_match_lineups_recorded_by_user_id_users",
                "match_lineups",
                type_="foreignkey",
            )
        except Exception:
            pass
        try:
            op.drop_constraint(
                "fk_match_lineups_training_session_id_sessions",
                "match_lineups",
                type_="foreignkey",
            )
        except Exception:
            pass
        op.drop_table("match_lineups")

