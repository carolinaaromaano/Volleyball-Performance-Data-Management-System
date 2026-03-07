from typing import List

from fastapi import APIRouter, Depends
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

