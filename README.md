# Volleyball Performance Data Management System

Web app and **REST API** for managing volleyball performance-related data: **FastAPI + PostgreSQL + JWT** on the backend and **React + Vite** on the frontend (login and team management).

## Current features

### Backend (`backend/`)

- **FastAPI** with interactive docs at `/docs`.
- **JWT authentication**: `POST /auth/token` (OAuth2 password flow), `GET /auth/me`.
- **Users** with roles `coach` and `analyst`.
- **Teams** (`/teams`): create, list, get by id, update, delete (deleting a team removes its players and training sessions).
- **Players** (`/players`): full CRUD and list with optional filters `team_id` and `position`.
- **Training sessions** (`/sessions`): full CRUD and list with optional filters `team_id`, `date_from`, `date_to`, `type`.
- **Debug endpoint** `POST /users/seed-coach`: creates user `coach` if missing (default password in endpoint code: `coach123`).
- **Database schema** managed with **Alembic** (migrations under `backend/alembic/versions/`).
- **Secrets in environment**: `DATABASE_URL` and `SECRET_KEY` in `backend/.env` (see `backend/.env.example`). Do **not** commit `.env`.

### Frontend (`frontend/`)

- **React 18** + **Vite** + **React Router** (`/login`, `/teams`, `/players`, `/sessions`).
- **Login** page calling `POST /auth/token` (`application/x-www-form-urlencoded`).
- **Teams** page: list and create.
- **Players** page: filter by team, list, create (linked to a team).
- **Sessions** page: filter by team, list, create training sessions (API requires **coach** role to create).
- JWT stored in `localStorage`; shared header with user info and logout.
- Styles in `frontend/src/styles.css`.

## Requirements

- **Python 3.11+** (use whatever version you run locally; some setups use 3.14).
- **Node.js** + **npm** (for the frontend).
- **PostgreSQL** running with a database created for the app.

## Setup — Backend

From the **repository root**:

```powershell
python -m venv venv
.\venv\Scripts\activate
pip install -r backend\requirements.txt
```

Also install **psycopg 3** if your URL uses `postgresql+psycopg://` (as in `.env.example`):

```powershell
pip install "psycopg[binary]"
```

### Environment variables

```powershell
cd backend
copy .env.example .env
```

Edit `backend/.env` and set at least:

- `DATABASE_URL` — PostgreSQL connection string (user, password, host, port, database name).
- `SECRET_KEY` — long random string used to sign JWTs (must be unique and secret in production).

### Migrations (Alembic)

From the **`backend/`** directory (with the venv activated):

```powershell
cd backend
..\venv\Scripts\python.exe -m alembic upgrade head
```

If the database **already had these tables** from an older setup and you do not want to recreate them:

```powershell
..\venv\Scripts\python.exe -m alembic stamp 0001_initial
```

### Run the API

From the **repository root**:

```powershell
uvicorn backend.app.main:app --reload --reload-dir backend\app
```

API: `http://127.0.0.1:8000` — Docs: `http://127.0.0.1:8000/docs`.

### Quick auth check

1. In `/docs`, run `POST /users/seed-coach` once.
2. Run `POST /auth/token` with `username: coach`, `password: coach123`.
3. Use **Authorize** in Swagger or `Authorization: Bearer <token>` for protected routes.

## Setup — Frontend

`package.json` lives under **`frontend/`**, not the repo root.

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The app calls the API at `http://127.0.0.1:8000` unless you set `VITE_API_URL` in a Vite `.env` file or at build time.

Keep the **API running** while you use the frontend.

## Repository layout

```
backend/
  app/           # FastAPI: routers, models, crud, schemas, security, config
  alembic/       # Alembic migrations
  alembic.ini
  .env.example   # template (copy to .env)
  requirements.txt
frontend/
  src/           # React: App, components, API client, styles
  package.json
  vite.config.js
```

## Notes

- **CORS** is permissive in development (`allow_origins=["*"]`) for the React dev server; restrict origins in production.
- **`backend/.env`** is listed in `backend/.gitignore` and must not be pushed to the remote.
