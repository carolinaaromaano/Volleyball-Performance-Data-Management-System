from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from .database import Base


class RoleEnum(str, PyEnum):
    COACH = "coach"
    ANALYST = "analyst"
    ADMIN = "admin"


class TeamGender(str, PyEnum):
    FEMALE = "female"
    MALE = "male"


class TeamCompetition(str, PyEnum):
    NATIONAL_LEAGUE = "national_league"
    DIVISION_2 = "division_2"
    REGIONAL_LEAGUES = "regional_leagues"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default=RoleEnum.COACH)
    is_active = Column(Boolean, default=True)

    teams_coached = relationship("Team", back_populates="coach")


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    category = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    competition = Column(String, nullable=True)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    coach = relationship("User", back_populates="teams_coached")
    players = relationship("Player", back_populates="team")
    sessions = relationship(
        "TrainingSession",
        back_populates="team",
        foreign_keys="TrainingSession.team_id",
    )
    stat_records = relationship("StatRecord", back_populates="team")


class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    position = Column(String, nullable=True)
    number = Column(Integer, nullable=True)

    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team = relationship("Team", back_populates="players")
    stat_records = relationship("StatRecord", back_populates="player")


class TrainingSession(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, default=date.today)
    type = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team = relationship("Team", back_populates="sessions", foreign_keys=[team_id])
    stat_records = relationship("StatRecord", back_populates="training_session")

    # Match support (optional)
    is_match = Column(Boolean, default=False, nullable=False)
    opponent_team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    opponent_team = relationship("Team", foreign_keys=[opponent_team_id])

    created_at = Column(DateTime, default=datetime.utcnow)

    match_lineups = relationship(
        "MatchLineup",
        back_populates="match_session",
        cascade="all, delete-orphan",
    )
    match_events = relationship(
        "MatchPointEvent",
        back_populates="match_session",
        cascade="all, delete-orphan",
    )


class MatchLineup(Base):
    __tablename__ = "match_lineups"

    id = Column(Integer, primary_key=True, index=True)
    training_session_id = Column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    side = Column(String, nullable=False)
    set_number = Column(Integer, nullable=False, default=1)
    team_name = Column(String, nullable=True)

    p1 = Column(Integer, nullable=True)
    p2 = Column(Integer, nullable=True)
    p3 = Column(Integer, nullable=True)
    p4 = Column(Integer, nullable=True)
    p5 = Column(Integer, nullable=True)
    p6 = Column(Integer, nullable=True)

    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    match_session = relationship("TrainingSession", back_populates="match_lineups")


class MatchPointEvent(Base):
    __tablename__ = "match_point_events"

    id = Column(Integer, primary_key=True, index=True)
    training_session_id = Column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    set_number = Column(Integer, nullable=False, default=1, index=True)
    rally_index = Column(Integer, nullable=False, index=True)
    scoring_side = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    player_number = Column(Integer, nullable=True)
    player_in_number = Column(Integer, nullable=True)
    player_out_number = Column(Integer, nullable=True)

    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    match_session = relationship("TrainingSession", back_populates="match_events")


class StatRecord(Base):
    __tablename__ = "stat_records"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    player_id = Column(
        Integer, ForeignKey("players.id", ondelete="CASCADE"), nullable=True
    )
    training_session_id = Column(
        Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True
    )
    metric_key = Column(String, nullable=False, index=True)
    value = Column(Float, nullable=False)
    recorded_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    team = relationship("Team", back_populates="stat_records")
    player = relationship("Player", back_populates="stat_records")
    training_session = relationship("TrainingSession", back_populates="stat_records")
