from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import crud, database, models, schemas
from .database import get_db
from .routers import auth, players, sessions, teams


models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(
    title="Volleyball Performance Data Management API",
    version="0.1.0",
)

# Dev helper: allow React (Vite) to call the API.
# If you deploy, set explicit origins instead of "*".
app.add_middleware(
    CORSMiddleware,
    # Dev: allow any origin so the React dev server can reach the API.
    # We're using Authorization headers (not cookies), so credentials are not required.
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
    """
    Endpoint rápido para crear un usuario coach inicial en la BD.
    Úsalo una vez para generar credenciales para probar el login JWT.
    """
    existing = crud.get_user_by_username(db, username="coach")
    if existing:
        return existing
    user_in = schemas.UserCreate(username="coach", password="coach123", role="coach")
    return crud.create_user(db, user_in)


app.include_router(auth.router)
app.include_router(teams.router)
app.include_router(players.router)
app.include_router(sessions.router)

