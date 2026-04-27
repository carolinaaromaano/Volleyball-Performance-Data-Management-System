from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..permissions import API_STAFF_ROLES, can_manage_team, is_coach
from .auth import get_current_user, require_role


router = APIRouter(prefix="/players", tags=["players"])


@router.post(
    "", response_model=schemas.Player, dependencies=[Depends(require_role(API_STAFF_ROLES))]
)
def create_player(
    player_in: schemas.PlayerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, player_in.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add players to teams you manage",
        )
    return crud.create_player(db, player_in)


@router.get(
    "",
    response_model=List[schemas.Player],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def list_players(
    skip: int = 0,
    limit: int = 100,
    team_id: int | None = None,
    position: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Coaches should only see players from teams they created/own (teams.coach_id == user.id).
    if is_coach(current_user):
        return crud.get_players_for_coach_created_teams(
            db,
            coach_user_id=current_user.id,
            skip=skip,
            limit=limit,
            team_id=team_id,
            position=position,
        )
    return crud.get_players(db, skip=skip, limit=limit, team_id=team_id, position=position)


@router.get(
    "/{player_id}",
    response_model=schemas.Player,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
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
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def update_player(
    player_id: int,
    player_in: schemas.PlayerCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = crud.get_player(db, player_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
        )
    if not can_manage_team(db, current_user, existing.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update players on teams you manage",
        )
    if not can_manage_team(db, current_user, player_in.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot move a player to a team you do not manage",
        )
    player = crud.update_player(db, player_id=player_id, player_in=player_in)
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
        )
    return player


@router.delete(
    "/{player_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def delete_player(
    player_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    existing = crud.get_player(db, player_id)
    if existing and not can_manage_team(db, current_user, existing.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete players from teams you manage",
        )
    deleted = crud.delete_player(db, player_id=player_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Player not found"
        )
    return None

