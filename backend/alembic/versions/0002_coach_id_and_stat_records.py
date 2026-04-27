"""coach_id on teams, stat_records table

Revision ID: 0002_coach_stats
Revises: 0001_initial
Create Date: 2026-04-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0002_coach_stats"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    # Make this migration safe to run on DBs that already have drift-fixed columns.
    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS coach_id INTEGER"))
        op.execute(
            sa.text(
                """
                DO $bootstrap$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_teams_coach_id_users'
                  ) THEN
                    ALTER TABLE teams
                      ADD CONSTRAINT fk_teams_coach_id_users
                      FOREIGN KEY (coach_id) REFERENCES users(id);
                  END IF;
                END
                $bootstrap$;
                """
            )
        )
    else:
        # Best-effort for non-Postgres: only add if missing.
        cols = {c["name"] for c in insp.get_columns("teams")}
        if "coach_id" not in cols:
            op.add_column("teams", sa.Column("coach_id", sa.Integer(), nullable=True))
        fks = {fk.get("name") for fk in insp.get_foreign_keys("teams")}
        if "fk_teams_coach_id_users" not in fks:
            op.create_foreign_key(
                "fk_teams_coach_id_users",
                "teams",
                "users",
                ["coach_id"],
                ["id"],
            )

    if not insp.has_table("stat_records"):
        op.create_table(
            "stat_records",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("team_id", sa.Integer(), nullable=False),
            sa.Column("player_id", sa.Integer(), nullable=True),
            sa.Column("training_session_id", sa.Integer(), nullable=True),
            sa.Column("metric_key", sa.String(), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("recorded_by_user_id", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(
                ["training_session_id"], ["sessions.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["recorded_by_user_id"],
                ["users.id"],
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_stat_records_id"), "stat_records", ["id"], unique=False)
        op.create_index(
            op.f("ix_stat_records_metric_key"),
            "stat_records",
            ["metric_key"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if insp.has_table("stat_records"):
        op.drop_index(op.f("ix_stat_records_metric_key"), table_name="stat_records")
        op.drop_index(op.f("ix_stat_records_id"), table_name="stat_records")
        op.drop_table("stat_records")

    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE teams DROP CONSTRAINT IF EXISTS fk_teams_coach_id_users"))
        op.execute(sa.text("ALTER TABLE teams DROP COLUMN IF EXISTS coach_id"))
    else:
        try:
            op.drop_constraint("fk_teams_coach_id_users", "teams", type_="foreignkey")
        except Exception:
            pass
        cols = {c["name"] for c in insp.get_columns("teams")}
        if "coach_id" in cols:
            op.drop_column("teams", "coach_id")
