from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from .auth import require_role


router = APIRouter(prefix="/players", tags=["players"])


@router.post(
    "", response_model=schemas.Player, dependencies=[Depends(require_role(["coach", "analyst"]))]
)
def create_player(player_in: schemas.PlayerCreate, db: Session = Depends(get_db)):
    return crud.create_player(db, player_in)


@router.get(
    "", response_model=List[schemas.Player], dependencies=[Depends(require_role(["coach", "analyst"]))]
)
def list_players(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_players(db, skip=skip, limit=limit)

