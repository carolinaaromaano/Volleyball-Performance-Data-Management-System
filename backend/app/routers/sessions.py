from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Query
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..permissions import API_STAFF_ROLES, can_manage_team
from .auth import get_current_user, require_role


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post(
    "",
    response_model=schemas.TrainingSession,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def create_session(
    session_in: schemas.TrainingSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, session_in.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only create sessions for teams you manage",
        )
    if session_in.is_match:
        if session_in.opponent_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="opponent_team_id is required for matches",
            )
        if session_in.opponent_team_id == session_in.team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opponent team cannot be the same as your team",
            )
        team = crud.get_team(db, session_in.team_id)
        opp = crud.get_team(db, session_in.opponent_team_id)
        if not team or not opp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team or opponent team not found",
            )
        # Same category = same gender + same competition.
        if team.gender != opp.gender or team.competition != opp.competition:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opponent team must be in the same category (gender and competition)",
            )
    else:
        # Ensure opponent is not accidentally set for training sessions.
        if session_in.opponent_team_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="opponent_team_id is only allowed when is_match is true",
            )
    return crud.create_training_session(db, session_in)


@router.get(
    "", response_model=List[schemas.TrainingSession], dependencies=[Depends(require_role(API_STAFF_ROLES))]
)
def list_sessions(
    skip: int = 0,
    limit: int = 100,
    team_id: Optional[int] = None,
    date_from: Optional[date] = Query(None, alias="date_from"),
    date_to: Optional[date] = Query(None, alias="date_to"),
    session_type: Optional[str] = Query(None, alias="type"),
    db: Session = Depends(get_db),
):
    return crud.get_training_sessions(
        db,
        skip=skip,
        limit=limit,
        team_id=team_id,
        date_from=date_from,
        date_to=date_to,
        session_type=session_type,
    )


@router.get(
    "/{session_id}",
    response_model=schemas.TrainingSession,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = crud.get_training_session(db, session_id=session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return session


@router.put(
    "/{session_id}",
    response_model=schemas.TrainingSession,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def update_session(
    session_id: int,
    session_in: schemas.TrainingSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = crud.get_training_session(db, session_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    if not can_manage_team(db, current_user, existing.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update sessions for teams you manage",
        )
    if not can_manage_team(db, current_user, session_in.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot move a session to a team you do not manage",
        )
    if session_in.is_match:
        if session_in.opponent_team_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="opponent_team_id is required for matches",
            )
        if session_in.opponent_team_id == session_in.team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opponent team cannot be the same as your team",
            )
        team = crud.get_team(db, session_in.team_id)
        opp = crud.get_team(db, session_in.opponent_team_id)
        if not team or not opp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Team or opponent team not found",
            )
        if team.gender != opp.gender or team.competition != opp.competition:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Opponent team must be in the same category (gender and competition)",
            )
    else:
        if session_in.opponent_team_id is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="opponent_team_id is only allowed when is_match is true",
            )
    session = crud.update_training_session(
        db, session_id=session_id, session_in=session_in
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return session


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = crud.get_training_session(db, session_id)
    if existing and not can_manage_team(db, current_user, existing.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete sessions for teams you manage",
        )
    deleted = crud.delete_training_session(db, session_id=session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return None

