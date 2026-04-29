from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..permissions import API_STAFF_ROLES, can_manage_team
from .auth import get_current_user, require_role


router = APIRouter(prefix="/match-stats", tags=["match-stats"])


def _get_match_or_400(db: Session, match_session_id: int) -> models.TrainingSession:
    sess = crud.get_training_session(db, match_session_id)
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    if not sess.is_match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is not a match",
        )
    return sess


@router.get(
    "/{match_session_id}/lineups",
    response_model=List[schemas.MatchLineup],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def list_lineups(
    match_session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sess = _get_match_or_400(db, match_session_id)
    if not can_manage_team(db, current_user, sess.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view match stats for teams you manage",
        )
    return crud.get_match_lineups(db, match_session_id)


@router.put(
    "/{match_session_id}/lineups/{side}",
    response_model=schemas.MatchLineup,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def save_lineup(
    match_session_id: int,
    side: schemas.MatchSide,
    body: schemas.MatchLineupCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sess = _get_match_or_400(db, match_session_id)
    if not can_manage_team(db, current_user, sess.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit match stats for teams you manage",
        )
    if body.training_session_id != match_session_id or body.side != side:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload does not match path",
        )
    return crud.upsert_match_lineup(db, body, current_user.id)


@router.get(
    "/{match_session_id}/events",
    response_model=List[schemas.MatchPointEvent],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def list_events(
    match_session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sess = _get_match_or_400(db, match_session_id)
    if not can_manage_team(db, current_user, sess.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view match stats for teams you manage",
        )
    return crud.get_match_point_events(db, match_session_id)


@router.post(
    "/{match_session_id}/events",
    response_model=schemas.MatchPointEvent,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def add_event(
    match_session_id: int,
    body: schemas.MatchPointEventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sess = _get_match_or_400(db, match_session_id)
    if not can_manage_team(db, current_user, sess.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit match stats for teams you manage",
        )
    if body.training_session_id != match_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payload does not match path",
        )

    home_lineup = crud.get_match_lineup(db, match_session_id, "home", body.set_number)
    away_lineup = crud.get_match_lineup(db, match_session_id, "away", body.set_number)
    if not home_lineup or not away_lineup:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Set {body.set_number} lineups must be recorded for both teams before recording events",
        )
    return crud.create_match_point_event(db, body, current_user.id)


@router.delete(
    "/{match_session_id}/events/last",
    response_model=schemas.MatchPointEvent,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def undo_last_event(
    match_session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    sess = _get_match_or_400(db, match_session_id)
    if not can_manage_team(db, current_user, sess.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit match stats for teams you manage",
        )
    deleted = crud.delete_last_match_point_event(db, match_session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No events to undo"
        )
    return deleted

