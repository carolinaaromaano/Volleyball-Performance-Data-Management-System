"""match support on sessions

Revision ID: 0004_session_matches
Revises: 0003_team_gender_competition
Create Date: 2026-04-25

Adds optional match fields to sessions:
- is_match (boolean)
- opponent_team_id (FK to teams)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0004_session_matches"
down_revision: Union[str, None] = "0003_team_gender_competition"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if bind.dialect.name == "postgresql":
        op.execute(
            sa.text(
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_match BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        op.execute(
            sa.text(
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS opponent_team_id INTEGER"
            )
        )
        op.execute(
            sa.text(
                """
                DO $bootstrap$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'fk_sessions_opponent_team_id_teams'
                  ) THEN
                    ALTER TABLE sessions
                      ADD CONSTRAINT fk_sessions_opponent_team_id_teams
                      FOREIGN KEY (opponent_team_id) REFERENCES teams(id);
                  END IF;
                END
                $bootstrap$;
                """
            )
        )
    else:
        cols = {c["name"] for c in insp.get_columns("sessions")}
        if "is_match" not in cols:
            op.add_column(
                "sessions",
                sa.Column("is_match", sa.Boolean(), nullable=False, server_default=sa.false()),
            )
        if "opponent_team_id" not in cols:
            op.add_column("sessions", sa.Column("opponent_team_id", sa.Integer(), nullable=True))
        fks = {fk.get("name") for fk in insp.get_foreign_keys("sessions")}
        if "fk_sessions_opponent_team_id_teams" not in fks:
            op.create_foreign_key(
                "fk_sessions_opponent_team_id_teams",
                "sessions",
                "teams",
                ["opponent_team_id"],
                ["id"],
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = inspect(bind)

    if bind.dialect.name == "postgresql":
        op.execute(sa.text("ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_opponent_team_id_teams"))
        op.execute(sa.text("ALTER TABLE sessions DROP COLUMN IF EXISTS opponent_team_id"))
        op.execute(sa.text("ALTER TABLE sessions DROP COLUMN IF EXISTS is_match"))
    else:
        try:
            op.drop_constraint(
                "fk_sessions_opponent_team_id_teams",
                "sessions",
                type_="foreignkey",
            )
        except Exception:
            pass
        cols = {c["name"] for c in insp.get_columns("sessions")}
        if "opponent_team_id" in cols:
            op.drop_column("sessions", "opponent_team_id")
        if "is_match" in cols:
            op.drop_column("sessions", "is_match")

