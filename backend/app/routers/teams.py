from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Query
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..permissions import API_STAFF_ROLES, can_manage_team, is_coach
from .auth import get_current_user, require_role


router = APIRouter(prefix="/teams", tags=["teams"])


@router.post(
    "", response_model=schemas.Team, dependencies=[Depends(require_role(API_STAFF_ROLES))]
)
def create_team(
    team_in: schemas.TeamCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    coach_id = current_user.id if is_coach(current_user) else None
    return crud.create_team(db, team_in, coach_id=coach_id)


@router.get(
    "", response_model=List[schemas.Team], dependencies=[Depends(require_role(API_STAFF_ROLES))]
)
def list_teams(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if is_coach(current_user):
        return crud.get_teams_for_coach(
            db, coach_user_id=current_user.id, skip=skip, limit=limit
        )
    return crud.get_teams(db, skip=skip, limit=limit)


@router.get(
    "/{team_id}",
    response_model=schemas.Team,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, team_id=team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return team


@router.get(
    "/{team_id}/opponents",
    response_model=List[schemas.Team],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def list_opponents_same_category(
    team_id: int,
    skip: int = 0,
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only list opponents for teams you manage",
        )
    return crud.get_opponent_teams_same_category(db, team_id=team_id, skip=skip, limit=limit)


@router.put(
    "/{team_id}",
    response_model=schemas.Team,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def update_team(
    team_id: int,
    team_in: schemas.TeamCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update teams you manage",
        )
    team = crud.update_team(db, team_id=team_id, team_in=team_in)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return team


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete teams you manage",
        )
    deleted = crud.delete_team(db, team_id=team_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return None

