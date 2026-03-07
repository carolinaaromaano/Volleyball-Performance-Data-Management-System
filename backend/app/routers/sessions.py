from typing import List

from fastapi import APIRouter, Depends
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
def list_sessions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_training_sessions(db, skip=skip, limit=limit)

