from typing import List, Optional

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


def create_team(db: Session, team_in: schemas.TeamCreate) -> models.Team:
    db_team = models.Team(**team_in.model_dump())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team


def get_teams(db: Session, skip: int = 0, limit: int = 100) -> List[models.Team]:
    return db.query(models.Team).offset(skip).limit(limit).all()


def create_player(db: Session, player_in: schemas.PlayerCreate) -> models.Player:
    db_player = models.Player(**player_in.model_dump())
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player


def get_players(db: Session, skip: int = 0, limit: int = 100) -> List[models.Player]:
    return db.query(models.Player).offset(skip).limit(limit).all()


def create_training_session(
    db: Session, session_in: schemas.TrainingSessionCreate
) -> models.TrainingSession:
    db_session = models.TrainingSession(**session_in.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def get_training_sessions(
    db: Session, skip: int = 0, limit: int = 100
) -> List[models.TrainingSession]:
    return db.query(models.TrainingSession).offset(skip).limit(limit).all()

