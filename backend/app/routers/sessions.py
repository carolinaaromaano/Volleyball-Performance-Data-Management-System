from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Query
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from .auth import require_role


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post(
    "", response_model=schemas.TrainingSession, dependencies=[Depends(require_role(["coach"]))]
)
def create_session(session_in: schemas.TrainingSessionCreate, db: Session = Depends(get_db)):
    return crud.create_training_session(db, session_in)


@router.get(
    "", response_model=List[schemas.TrainingSession], dependencies=[Depends(require_role(["coach", "analyst"]))]
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
    dependencies=[Depends(require_role(["coach", "analyst"]))],
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
    dependencies=[Depends(require_role(["coach"]))],
)
def update_session(
    session_id: int,
    session_in: schemas.TrainingSessionCreate,
    db: Session = Depends(get_db),
):
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
    dependencies=[Depends(require_role(["coach"]))],
)
def delete_session(session_id: int, db: Session = Depends(get_db)):
    deleted = crud.delete_training_session(db, session_id=session_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return None

