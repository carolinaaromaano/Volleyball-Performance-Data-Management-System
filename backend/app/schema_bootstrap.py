"""
Apply small, idempotent DDL so older databases match current models.

Alembic remains the source of truth for full migrations; this only patches
common drift (gender, competition, coach_id + FK when migration 0002 was skipped).
"""
import logging

from sqlalchemy import text

from .database import engine

logger = logging.getLogger(__name__)


def ensure_teams_demographics_columns() -> None:
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            exists = conn.execute(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'teams'"
                    ")"
                )
            ).scalar()
            if not exists:
                return
            conn.execute(
                text("ALTER TABLE teams ADD COLUMN IF NOT EXISTS gender VARCHAR")
            )
            conn.execute(
                text(
                    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS competition VARCHAR"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE teams ADD COLUMN IF NOT EXISTS coach_id INTEGER"
                )
            )
            conn.execute(
                text(
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
    except Exception:
        logger.exception("schema_bootstrap: could not ensure teams columns")


def ensure_sessions_match_columns() -> None:
    """Backfill common drift if migration 0004 was skipped."""
    if engine.dialect.name != "postgresql":
        return
    try:
        with engine.begin() as conn:
            exists = conn.execute(
                text(
                    "SELECT EXISTS ("
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = 'sessions'"
                    ")"
                )
            ).scalar()
            if not exists:
                return
            conn.execute(
                text(
                    "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_match BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            conn.execute(
                text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS opponent_team_id INTEGER")
            )
            conn.execute(
                text(
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
    except Exception:
        logger.exception("schema_bootstrap: could not ensure sessions match columns")
