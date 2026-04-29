from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, models, schema_bootstrap, schemas
from .database import get_db
from .routers import auth, match_stats, players, scouting, sessions, stats, teams


@asynccontextmanager
async def lifespan(app: FastAPI):
    schema_bootstrap.ensure_teams_demographics_columns()
    schema_bootstrap.ensure_sessions_match_columns()
    yield



app = FastAPI(
    title="Volleyball Performance Data Management API",
    version="0.1.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"message": "API running"}


@app.post("/users/seed-coach", response_model=schemas.User, tags=["debug"])
def seed_initial_coach(
    db: Session = Depends(get_db),
):

    existing = crud.get_user_by_username(db, username="coach")
    if existing:
        return existing
    user_in = schemas.UserCreate(username="coach", password="coach123", role="coach")
    return crud.create_user(db, user_in)


@app.post("/users/seed-admin", response_model=schemas.User, tags=["debug"])
def seed_initial_admin(
    db: Session = Depends(get_db),
):

    existing = crud.get_user_by_username(db, username="admin")
    if existing:
        return existing
    user_in = schemas.UserCreate(
        username="admin",
        password="admin123",
        role=models.RoleEnum.ADMIN.value,
    )
    return crud.create_user(db, user_in)


app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(sessions.router)
app.include_router(stats.router)
app.include_router(match_stats.router)
app.include_router(scouting.router)

