from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
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
    "",
    response_model=List[schemas.Player],
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def list_players(
    skip: int = 0,
    limit: int = 100,
    team_id: int | None = None,
    position: str | None = None,
    db: Session = Depends(get_db),
):
    return crud.get_players(
        db, skip=skip, limit=limit, team_id=team_id, position=position
    )


@router.get(
    "/{player_id}",
    response_model=schemas.Player,
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def get_player(player_id: int, db: Session = Depends(get_db)):
    player = crud.get_player(db, player_id=player_id)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
        )
    return player


@router.put(
    "/{player_id}",
    response_model=schemas.Player,
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def update_player(
    player_id: int, player_in: schemas.PlayerCreate, db: Session = Depends(get_db)
):
    player = crud.update_player(db, player_id=player_id, player_in=player_in)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
        )
    return player


@router.delete(
    "/{player_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(["coach", "analyst"]))],
)
def delete_player(player_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_player(db, player_id=player_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
        )
    return None

