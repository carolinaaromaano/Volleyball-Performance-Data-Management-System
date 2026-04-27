from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import crud, models, schemas
from ..database import get_db
from ..permissions import API_STAFF_ROLES, can_manage_team
from .auth import get_current_user, require_role

router = APIRouter(prefix="/stats", tags=["stats"])


@router.post(
    "/entry",
    response_model=List[schemas.StatRecord],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def create_stat_entry(
    body: schemas.StatEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, body.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add statistics for teams you manage",
        )
    player = crud.get_player(db, body.player_id)
    if not player or player.team_id != body.team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Player does not belong to this team",
        )
    if body.training_session_id is not None:
        sess = crud.get_training_session(db, body.training_session_id)
        if not sess or sess.team_id != body.team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session does not belong to this team",
            )
    creates = crud.expand_stat_entry(body)
    try:
        return crud.create_stat_records_bulk(db, creates, current_user.id)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))


@router.post(
    "",
    response_model=schemas.StatRecord,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def create_stat(
    body: schemas.StatRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, body.team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only add statistics for teams you manage",
        )
    if body.player_id is not None:
        player = crud.get_player(db, body.player_id)
        if not player or player.team_id != body.team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Player does not belong to this team",
            )
    if body.training_session_id is not None:
        sess = crud.get_training_session(db, body.training_session_id)
        if not sess or sess.team_id != body.team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session does not belong to this team",
            )
    if not body.metric_key or not body.metric_key.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="metric_key is required",
        )
    try:
        return crud.create_stat_record(db, body, current_user.id)
    except RuntimeError as e:
        raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(e))


@router.get(
    "",
    response_model=List[schemas.StatRecord],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def list_stats_detail(
    team_id: int = Query(..., description="Team to list statistics for"),
    player_id: Optional[int] = None,
    training_session_id: Optional[int] = None,
    skip: int = 0,
    limit: int = Query(500, le=2000),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not can_manage_team(db, current_user, team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Detailed stats are only available for teams you manage; use summary for other teams",
        )
    return crud.get_stat_records(
        db,
        team_id=team_id,
        player_id=player_id,
        training_session_id=training_session_id,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/teams/{team_id}/summary",
    response_model=List[schemas.StatSummaryRow],
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def team_stats_summary(team_id: int, db: Session = Depends(get_db)):
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    rows = crud.aggregate_stats_by_metric_for_team(db, team_id)
    return [schemas.StatSummaryRow(metric_key=k, total=t) for k, t in rows]


@router.get(
    "/teams/{team_id}/players-chart",
    response_model=schemas.TeamPlayerStatsChartResponse,
    dependencies=[Depends(require_role(API_STAFF_ROLES))],
)
def team_player_stats_charts(
    team_id: int,
    training_session_id: Optional[int] = Query(
        None, description="If set, totals are limited to this training session."
    ),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Team not found"
        )
    if not can_manage_team(db, current_user, team_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view player charts for teams you manage",
        )
    if training_session_id is not None:
        sess = crud.get_training_session(db, training_session_id)
        if not sess or sess.team_id != team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session does not belong to this team",
            )
    return crud.build_team_player_stats_chart_response(
        db, team_id, training_session_id
    )
