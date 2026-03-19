from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from .auth import require_role


router = APIRouter(prefix="/teams", tags=["teams"])


@router.post(
    "", response_model=schemas.Team, dependencies=[Depends(require_role(["coach", "analyst"]))]
)
def create_team(team_in: schemas.TeamCreate, db: Session = Depends(get_db)):
    return crud.create_team(db, team_in)


@router.get(
    "", response_model=List[schemas.Team], dependencies=[Depends(require_role(["coach", "analyst"]))]
)
def list_teams(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_teams(db, skip=skip, limit=limit)


@router.get(
    "/{team_id}",
    response_model=schemas.Team,
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def get_team(team_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, team_id=team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return team


@router.put(
    "/{team_id}",
    response_model=schemas.Team,
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def update_team(team_id: int, team_in: schemas.TeamCreate, db: Session = Depends(get_db)):
    team = crud.update_team(db, team_id=team_id, team_in=team_in)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return team


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def delete_team(team_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_team(db, team_id=team_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    return None

