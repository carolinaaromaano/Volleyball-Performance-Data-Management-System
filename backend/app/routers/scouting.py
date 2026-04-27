from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, ml_scouting, models, schemas
from ..database import get_db
from ..permissions import user_role_str
from .auth import get_current_user, require_role


router = APIRouter(prefix="/scouting", tags=["scouting"])


def _can_access_category(db: Session, user: models.User, gender: str, competition: str) -> bool:
    r = user_role_str(user)
    if r != models.RoleEnum.COACH.value:
        return False
    owned = crud.get_teams_owned_by_coach(db, coach_user_id=user.id)
    for t in owned:
        if (t.gender or "") == (gender or "") and (t.competition or "") == (competition or ""):
            return True
    return False


def _team_or_404(db: Session, team_id: int) -> models.Team:
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    return team


@router.get(
    "/teams",
    response_model=List[schemas.Team],
    dependencies=[Depends(require_role([models.RoleEnum.COACH.value]))],
)
def list_category_teams(
    gender: str = Query(...),
    competition: str = Query(...),
    skip: int = 0,
    limit: int = Query(200, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not _can_access_category(db, current_user, gender, competition):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only scout categories where you have a team",
        )
    q = db.query(models.Team).filter(models.Team.gender == gender).filter(models.Team.competition == competition)
    return q.order_by(models.Team.name.asc()).offset(skip).limit(limit).all()


@router.get(
    "/teams/{team_id}/players-chart",
    response_model=schemas.TeamPlayerStatsChartResponse,
    dependencies=[Depends(require_role([models.RoleEnum.COACH.value]))],
)
def team_player_charts_scouting(
    team_id: int,
    training_session_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    team = _team_or_404(db, team_id)
    if not _can_access_category(db, current_user, team.gender or "", team.competition or ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only scout categories where you have a team",
        )
    if training_session_id is not None:
        sess = crud.get_training_session(db, training_session_id)
        if not sess or sess.team_id != team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session does not belong to this team",
            )
    return crud.build_team_player_stats_chart_response(db, team_id, training_session_id)


@router.get(
    "/teams/{team_id}/insights",
    response_model=schemas.TeamScoutingInsightsResponse,
    dependencies=[Depends(require_role([models.RoleEnum.COACH.value]))],
)
def team_player_insights(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    team = _team_or_404(db, team_id)
    if not _can_access_category(db, current_user, team.gender or "", team.competition or ""):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only scout categories where you have a team",
        )
    return ml_scouting.build_insights(
        db,
        team_id=team_id,
        gender=team.gender or "",
        competition=team.competition or "",
    )

