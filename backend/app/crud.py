from datetime import date
from typing import List, Optional, Tuple

from sqlalchemy import delete, func, inspect
from sqlalchemy.orm import Session

from . import models, schemas, security


def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    hashed_password = security.get_password_hash(user_in.password)
    db_user = models.User(
        username=user_in.username,
        hashed_password=hashed_password,
        role=user_in.role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, username: str, password: str) -> Optional[models.User]:
    user = get_user_by_username(db, username=username)
    if not user:
        return None
    if not security.verify_password(password, user.hashed_password):
        return None
    return user


def create_team(
    db: Session, team_in: schemas.TeamCreate, coach_id: Optional[int] = None
) -> models.Team:
    db_team = models.Team(
        name=team_in.name,
        gender=team_in.gender.value,
        competition=team_in.competition.value,
        coach_id=coach_id,
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


def get_team(db: Session, team_id: int) -> Optional[models.Team]:
    return db.query(models.Team).filter(models.Team.id == team_id).first()


def get_teams(db: Session, skip: int = 0, limit: int = 100) -> List[models.Team]:
    return db.query(models.Team).offset(skip).limit(limit).all()


def get_teams_for_coach(
    db: Session, coach_user_id: int, skip: int = 0, limit: int = 100
) -> List[models.Team]:
    """Teams this coach may manage (assigned to them or unassigned)."""
    return (
        db.query(models.Team)
        .filter(
            (models.Team.coach_id == coach_user_id)
            | (models.Team.coach_id.is_(None))
        )
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_teams_owned_by_coach(
    db: Session, coach_user_id: int, skip: int = 0, limit: int = 500
) -> List[models.Team]:
    return (
        db.query(models.Team)
        .filter(models.Team.coach_id == coach_user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_opponent_teams_same_category(
    db: Session, team_id: int, skip: int = 0, limit: int = 200
) -> List[models.Team]:
    """
    Teams that can be selected as opponents: same gender + competition, excluding itself.
    """
    team = get_team(db, team_id=team_id)
    if not team:
        return []
    q = db.query(models.Team).filter(models.Team.id != team_id)
    q = q.filter(models.Team.gender == team.gender)
    q = q.filter(models.Team.competition == team.competition)
    return q.offset(skip).limit(limit).all()


def update_team(db: Session, team_id: int, team_in: schemas.TeamCreate) -> Optional[models.Team]:
    db_team = get_team(db, team_id=team_id)
    if not db_team:
        return None
    db_team.name = team_in.name
    db_team.gender = team_in.gender.value
    db_team.competition = team_in.competition.value
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


def delete_team(db: Session, team_id: int) -> bool:
    db_team = get_team(db, team_id=team_id)
    if not db_team:
        return False
    bind = db.get_bind()
    has_stat_records = inspect(bind).has_table("stat_records")
    if has_stat_records:
        for sr in list(db_team.stat_records):
            db.delete(sr)
        for player in list(db_team.players):
            db.delete(player)
        for session in list(db_team.sessions):
            db.delete(session)
        db.delete(db_team)
    else:
        # Bulk deletes avoid ORM flush loading stat_records on Player/TrainingSession.
        db.expunge(db_team)
        db.execute(
            delete(models.TrainingSession).where(
                models.TrainingSession.team_id == team_id
            )
        )
        db.execute(delete(models.Player).where(models.Player.team_id == team_id))
        db.execute(delete(models.Team).where(models.Team.id == team_id))
    db.commit()
    return True


def get_player(db: Session, player_id: int) -> Optional[models.Player]:
    return db.query(models.Player).filter(models.Player.id == player_id).first()


def create_player(db: Session, player_in: schemas.PlayerCreate) -> models.Player:
    db_player = models.Player(**player_in.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


def get_players(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    team_id: Optional[int] = None,
    position: Optional[str] = None,
) -> List[models.Player]:
    query = db.query(models.Player)
    if team_id is not None:
        query = query.filter(models.Player.team_id == team_id)
    if position is not None:
        query = query.filter(models.Player.position == position)
    return query.offset(skip).limit(limit).all()


def get_players_for_coach_created_teams(
    db: Session,
    coach_user_id: int,
    skip: int = 0,
    limit: int = 100,
    team_id: Optional[int] = None,
    position: Optional[str] = None,
) -> List[models.Player]:
    """
    Players limited to teams created/owned by this coach (teams.coach_id == coach_user_id).
    """
    query = db.query(models.Player).join(models.Team, models.Team.id == models.Player.team_id)
    query = query.filter(models.Team.coach_id == coach_user_id)
    if team_id is not None:
        query = query.filter(models.Player.team_id == team_id)
    if position is not None:
        query = query.filter(models.Player.position == position)
    return query.offset(skip).limit(limit).all()


def update_player(
    db: Session, player_id: int, player_in: schemas.PlayerCreate
) -> Optional[models.Player]:
    db_player = get_player(db, player_id=player_id)
    if not db_player:
        return None
    for field, value in player_in.model_dump().items():
        setattr(db_player, field, value)
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


def delete_player(db: Session, player_id: int) -> bool:
    db_player = get_player(db, player_id=player_id)
    if not db_player:
        return False
    db.delete(db_player)
    db.commit()
    return True


def create_training_session(
    db: Session, session_in: schemas.TrainingSessionCreate
) -> models.TrainingSession:
    db_session = models.TrainingSession(**session_in.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def get_training_sessions(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    team_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    session_type: Optional[str] = None,
) -> List[models.TrainingSession]:
    query = db.query(models.TrainingSession)
    if team_id is not None:
        query = query.filter(models.TrainingSession.team_id == team_id)
    if date_from is not None:
        query = query.filter(models.TrainingSession.date >= date_from)
    if date_to is not None:
        query = query.filter(models.TrainingSession.date <= date_to)
    if session_type is not None:
        query = query.filter(models.TrainingSession.type == session_type)
    return query.offset(skip).limit(limit).all()


def get_training_session(
    db: Session, session_id: int
) -> Optional[models.TrainingSession]:
    return (
        db.query(models.TrainingSession)
        .filter(models.TrainingSession.id == session_id)
        .first()
    )


def update_training_session(
    db: Session,
    session_id: int,
    session_in: schemas.TrainingSessionCreate,
) -> Optional[models.TrainingSession]:
    db_session = get_training_session(db, session_id=session_id)
    if not db_session:
        return None
    for field, value in session_in.model_dump().items():
        setattr(db_session, field, value)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def delete_training_session(db: Session, session_id: int) -> bool:
    db_session = get_training_session(db, session_id=session_id)
    if not db_session:
        return False
    db.delete(db_session)
    db.commit()
    return True


def upsert_match_lineup(
    db: Session,
    lineup_in: schemas.MatchLineupCreate,
    recorded_by_user_id: int,
) -> models.MatchLineup:
    existing = (
        db.query(models.MatchLineup)
        .filter(models.MatchLineup.training_session_id == lineup_in.training_session_id)
        .filter(models.MatchLineup.side == lineup_in.side)
        .filter(models.MatchLineup.set_number == lineup_in.set_number)
        .first()
    )
    data = lineup_in.model_dump()
    if existing:
        for k, v in data.items():
            setattr(existing, k, v)
        existing.recorded_by_user_id = recorded_by_user_id
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    row = models.MatchLineup(**data, recorded_by_user_id=recorded_by_user_id)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_match_lineups(db: Session, training_session_id: int) -> List[models.MatchLineup]:
    return (
        db.query(models.MatchLineup)
        .filter(models.MatchLineup.training_session_id == training_session_id)
        .order_by(models.MatchLineup.set_number.asc(), models.MatchLineup.side.asc())
        .all()
    )


def get_match_lineup(
    db: Session, training_session_id: int, side: str, set_number: int
) -> Optional[models.MatchLineup]:
    return (
        db.query(models.MatchLineup)
        .filter(models.MatchLineup.training_session_id == training_session_id)
        .filter(models.MatchLineup.side == side)
        .filter(models.MatchLineup.set_number == set_number)
        .first()
    )


def create_match_point_event(
    db: Session,
    event_in: schemas.MatchPointEventCreate,
    recorded_by_user_id: int,
) -> models.MatchPointEvent:
    # Guardrail: if DB isn't migrated yet, fail with a clear message.
    cols = {c["name"] for c in inspect(db.get_bind()).get_columns("match_point_events")}
    if event_in.event_type == "substitution" and (
        "player_in_number" not in cols or "player_out_number" not in cols
    ):
        raise RuntimeError(
            "Database is missing substitution columns. Run Alembic migrations: alembic upgrade head"
        )
    row = models.MatchPointEvent(
        **event_in.model_dump(), recorded_by_user_id=recorded_by_user_id
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def get_match_point_events(
    db: Session, training_session_id: int
) -> List[models.MatchPointEvent]:
    # Guardrail: give a clear error if code expects columns not present.
    cols = {c["name"] for c in inspect(db.get_bind()).get_columns("match_point_events")}
    if "player_in_number" not in cols or "player_out_number" not in cols:
        raise RuntimeError(
            "Database schema is out of date for match substitutions. Run: alembic upgrade head"
        )
    return (
        db.query(models.MatchPointEvent)
        .filter(models.MatchPointEvent.training_session_id == training_session_id)
        .order_by(
            models.MatchPointEvent.set_number.asc(),
            models.MatchPointEvent.rally_index.asc(),
            models.MatchPointEvent.id.asc(),
        )
        .all()
    )


def delete_last_match_point_event(
    db: Session, training_session_id: int
) -> Optional[models.MatchPointEvent]:
    row = (
        db.query(models.MatchPointEvent)
        .filter(models.MatchPointEvent.training_session_id == training_session_id)
        .order_by(
            models.MatchPointEvent.set_number.desc(),
            models.MatchPointEvent.rally_index.desc(),
            models.MatchPointEvent.id.desc(),
        )
        .first()
    )
    if not row:
        return None
    db.delete(row)
    db.commit()
    return row


def create_stat_record(
    db: Session, stat_in: schemas.StatRecordCreate, recorded_by_user_id: int
) -> models.StatRecord:
    # Older DBs may not have stat_records yet (migration 0002 not applied).
    if not inspect(db.get_bind()).has_table("stat_records"):
        raise RuntimeError(
            "stat_records table does not exist. Run Alembic migrations (upgrade head)."
        )
    row = models.StatRecord(
        team_id=stat_in.team_id,
        player_id=stat_in.player_id,
        training_session_id=stat_in.training_session_id,
        metric_key=stat_in.metric_key.strip(),
        value=stat_in.value,
        recorded_by_user_id=recorded_by_user_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def expand_stat_entry(entry: schemas.StatEntryCreate) -> List[schemas.StatRecordCreate]:
    """Turn a structured stat entry into per-metric StatRecordCreate rows (non-zero only)."""
    common = dict(
        team_id=entry.team_id,
        player_id=entry.player_id,
        training_session_id=entry.training_session_id,
    )
    pairs: List[tuple[str, int]] = []
    if entry.category == "attack":
        pairs = [
            ("attack_point", entry.attack_points),
            ("attack_fault", entry.attack_faults),
            ("attack_rally_continue", entry.attack_rally_continues),
        ]
    elif entry.category == "reception":
        pairs = [
            ("reception_positive", entry.reception_positives),
            ("reception_double_positive", entry.reception_double_positives),
            ("reception_fault", entry.reception_faults),
        ]
    elif entry.category == "serve":
        pairs = [
            ("serve_point", entry.serve_points),
            ("serve_fault", entry.serve_faults),
            ("serve_rally_continue", entry.serve_rally_continues),
        ]
    else:
        pairs = [
            ("block", entry.blocks),
            ("block_out", entry.blocks_out),
        ]
    return [
        schemas.StatRecordCreate(metric_key=k, value=float(v), **common)
        for k, v in pairs
        if v > 0
    ]


def create_stat_records_bulk(
    db: Session, items: List[schemas.StatRecordCreate], recorded_by_user_id: int
) -> List[models.StatRecord]:
    if not items:
        return []
    if not inspect(db.get_bind()).has_table("stat_records"):
        raise RuntimeError(
            "stat_records table does not exist. Run Alembic migrations (upgrade head)."
        )
    rows: List[models.StatRecord] = []
    for stat_in in items:
        row = models.StatRecord(
            team_id=stat_in.team_id,
            player_id=stat_in.player_id,
            training_session_id=stat_in.training_session_id,
            metric_key=stat_in.metric_key.strip(),
            value=float(stat_in.value),
            recorded_by_user_id=recorded_by_user_id,
        )
        db.add(row)
        rows.append(row)
    db.commit()
    for r in rows:
        db.refresh(r)
    return rows


def get_stat_records(
    db: Session,
    team_id: int,
    player_id: Optional[int] = None,
    training_session_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 500,
) -> List[models.StatRecord]:
    if not inspect(db.get_bind()).has_table("stat_records"):
        return []
    q = db.query(models.StatRecord).filter(models.StatRecord.team_id == team_id)
    if player_id is not None:
        q = q.filter(models.StatRecord.player_id == player_id)
    if training_session_id is not None:
        q = q.filter(models.StatRecord.training_session_id == training_session_id)
    return (
        q.order_by(models.StatRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def aggregate_stats_by_metric_for_team(
    db: Session, team_id: int
) -> List[Tuple[str, float]]:
    if not inspect(db.get_bind()).has_table("stat_records"):
        return []
    rows = (
        db.query(models.StatRecord.metric_key, func.sum(models.StatRecord.value))
        .filter(models.StatRecord.team_id == team_id)
        .group_by(models.StatRecord.metric_key)
        .all()
    )
    return [(metric_key, float(total)) for metric_key, total in rows]


def _player_metric_totals(
    db: Session, team_id: int, training_session_id: Optional[int]
) -> dict[tuple[int, str], float]:
    """(player_id, metric_key) -> sum(value) for player-attributed rows."""
    if not inspect(db.get_bind()).has_table("stat_records"):
        return {}
    q = (
        db.query(
            models.StatRecord.player_id,
            models.StatRecord.metric_key,
            func.sum(models.StatRecord.value),
        )
        .filter(
            models.StatRecord.team_id == team_id,
            models.StatRecord.player_id.isnot(None),
        )
    )
    if training_session_id is not None:
        q = q.filter(models.StatRecord.training_session_id == training_session_id)
    rows = q.group_by(
        models.StatRecord.player_id, models.StatRecord.metric_key
    ).all()
    out: dict[tuple[int, str], float] = {}
    for pid, key, total in rows:
        if pid is None:
            continue
        out[(int(pid), str(key))] = float(total or 0)
    return out


def build_team_player_stats_chart_response(
    db: Session, team_id: int, training_session_id: Optional[int]
) -> schemas.TeamPlayerStatsChartResponse:
    scope: schemas.StatChartScope = (
        "session" if training_session_id is not None else "general"
    )
    roster = (
        db.query(models.Player)
        .filter(models.Player.team_id == team_id)
        .order_by(models.Player.last_name, models.Player.first_name)
        .all()
    )
    totals = _player_metric_totals(db, team_id, training_session_id)

    def m(pid: int, key: str) -> float:
        return totals.get((pid, key), 0.0)

    players_out: List[schemas.PlayerStatBreakdown] = []
    for p in roster:
        pid = int(p.id)
        players_out.append(
            schemas.PlayerStatBreakdown(
                player_id=pid,
                first_name=p.first_name,
                last_name=p.last_name,
                attack=schemas.StatOutcomeTotals(
                    points=m(pid, "attack_point"),
                    faults=m(pid, "attack_fault"),
                    rally_continues=m(pid, "attack_rally_continue"),
                ),
                serve=schemas.StatOutcomeTotals(
                    points=m(pid, "serve_point"),
                    faults=m(pid, "serve_fault"),
                    rally_continues=m(pid, "serve_rally_continue"),
                ),
                reception=schemas.StatReceptionTotals(
                    positive=m(pid, "reception_positive"),
                    double_positive=m(pid, "reception_double_positive"),
                    fault=m(pid, "reception_fault"),
                ),
                block=schemas.StatBlockTotals(
                    total=m(pid, "block"),
                    outs=m(pid, "block_out"),
                ),
            )
        )
    return schemas.TeamPlayerStatsChartResponse(
        team_id=team_id,
        training_session_id=training_session_id,
        scope=scope,
        players=players_out,
    )

