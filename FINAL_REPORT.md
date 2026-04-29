Final Report
Dublin Business School
[Your Name]
Supervisor:
[Supervisor Name]
BSc (Hons) in Computing in Data Analytics
Word Count (Not including page 1): [To be calculated]

---

## Abstract:

The **Volleyball Performance Data Management System** is a full‑stack web application designed to help coaching staff and analysts **capture, manage, and interpret volleyball performance data** across teams, players, training sessions, and matches. The system provides role‑based access, a consistent workflow for recording statistics (attack, serve, reception, block), and match‑specific tooling including lineups, rally‑by‑rally point events, and substitution tracking. In addition to descriptive reporting, it includes a scouting module that generates player‑level strengths and vulnerabilities and produces category‑level comparisons for teams within the same competitive context.

This report presents a detailed overview of the system’s aims, design rationale, and implementation. It explains the data model, API structure, security and permission boundaries, and the primary user journeys implemented in the frontend. The report also evaluates the results achieved against the stated objectives, reflects on constraints and shortcomings, and proposes a clear set of future improvements to move the system from a project prototype to a production‑ready platform.

## Acknowledgements:

I would like to thank my supervisor, **[Supervisor Name]**, for guidance on structuring and delivering this project. I also thank the lecturers and staff of **Dublin Business School** whose teaching across software engineering, databases, and analytics informed the technical choices made. Finally, I would like to acknowledge classmates and peers who provided feedback during development and helped validate the usability of the application’s workflows.

## Contents

- Abstract
- Acknowledgements
- Chapter I: Introduction
  - Aims of the application
  - Objectives and Features
  - Expectation
  - Acceptance
  - Approach to the project
- Chapter II: Background
  - Context
  - Benefits of the application
  - User Target
  - Impacts of the project and Context Review
  - Agile & Rapid Application Development
  - Relevant Software & Tooling
- Chapter III: Literature Review
- Chapter IV: Application Structure & Login
  - System Architecture
  - Backend (API) Structure
  - Frontend Structure
  - Database Design
  - Login & Registration
  - Account / Identity (“Me”) Endpoint
- Chapter V: Teams, Players & Sessions
  - Teams
  - Players
  - Training Sessions
  - Match Sessions (session-as-match)
- Chapter VI: Statistics, Charts & Data Entry
  - Data Model for Statistics
  - Structured Stat Entry Workflow
  - Detail Views and Filtering
  - Chart Generation
- Chapter VII: Match Statistics (Lineups, Events, Substitutions)
  - Lineups by Set
  - Rally-by-rally Events
  - Undo / Correction Workflow
  - Data Quality Constraints
- Chapter VIII: Results and Evaluation
  - Results
  - Evaluation
  - Shortcomings
- Chapter IX: Conclusions and Future Work
  - Conclusions
  - Future Work
- References & Bibliography
- Appendices

---

## Chapter I: Introduction

Performance analysis has become a central part of modern volleyball coaching. However, many teams still rely on scattered spreadsheets, paper notes, or single‑purpose tools that do not integrate team management, session context, and longitudinal player statistics. This project addresses that gap by delivering a unified system that supports a coach/analyst workflow: **authenticate**, **manage rosters and sessions**, **record stats**, and **review insights** that can inform training priorities and match preparation.

The Volleyball Performance Data Management System is implemented as a web platform with:

- A **FastAPI** backend providing a REST API for authentication, team/roster/session management, statistics recording, match event capture, and scouting insights.
- A **React** frontend providing user journeys for recording and reviewing data, including interactive charts and category‑based stat entry.
- A relational database managed through **SQLAlchemy** models and **Alembic** migrations.

### Aims of the application:

The primary aim of the application is to provide coaching staff with an end‑to‑end system to:

- Centralise volleyball team information (teams, players, sessions).
- Enable accurate, consistent recording of player performance metrics across training and match contexts.
- Provide per‑player visual summaries to support decision‑making.
- Support match capture workflows (lineups, point events, substitutions) with validation rules that improve data quality.
- Provide a scouting workflow that is constrained by competitive context (gender + competition) and produces interpretable insights.

### Objectives and Features:

The core objectives of the project were translated into the following features.

**Objective 1 — Secure user access and role separation**

- Coach registration and token-based login.
- Role‑based access control for API endpoints.
- Permissions that restrict team data access to teams managed by the current coach, with broader access for analyst/admin roles.

**Objective 2 — Team and roster management**

- Create, list, update, and delete teams.
- Store team demographics / category context (gender and competition).
- Add and manage player rosters linked to a team.

**Objective 3 — Session management**

- Create and list sessions with date, type, notes, and team association.
- Model matches as specialised sessions using `is_match`, with optional opponent tracking.

**Objective 4 — Statistics capture and reporting**

- Store performance metrics in a flexible “metric key + value” format.
- Provide structured “stat entry” input that maps volleyball actions (attack/serve/reception/block) into a consistent set of metric rows.
- Provide detailed log views and filters (by team, player, session).
- Provide per‑player charts in two scopes:
  - General: aggregated across all sessions.
  - By session: scoped to one training or match session.

**Objective 5 — Match statistics capture**

- Capture lineups per set for both home and away sides.
- Capture rally‑by‑rally point events, including substitutions.
- Enforce prerequisites for event entry (lineups must exist for both sides for the set).
- Support undo of the most recent recorded event to reduce friction during live capture.

**Objective 6 — Scouting and insights**

- Limit scouting data visibility to coaches who participate in the same category context.
- Provide charts and insights for category teams to support opposition analysis.
- Produce strengths/vulnerabilities and best/worst comparisons by action.

### Expectation:

Based on the intended scope, the expected outcome was a working web system capable of:

- Authenticating users securely and consistently.
- Allowing a coach to manage at least one team, roster, and sessions.
- Recording and retrieving statistics reliably with validation.
- Supporting match workflows with integrity constraints to prevent invalid event capture.
- Producing visual summaries and basic insight outputs from stored data.

### Acceptance:

The project is accepted as complete when:

- The API runs successfully and returns correct responses for all main workflows.
- The frontend enables a user to complete end‑to‑end tasks:
  - Register/login → create team → add players → create sessions → record stats → view charts.
  - Mark a session as a match → save lineups → record match events → undo last event when needed.
  - Access scouting tools only when category access rules are satisfied.
- Permissions prevent a coach from viewing or modifying teams outside their control.

### Approach to the project:

Development followed an incremental approach where domain entities were implemented first (teams, players, sessions), followed by statistics capture and then match‑specific workflows. This sequencing was chosen because match events depend on a stable data model for sessions and team rosters, and because the frontend user journeys require reliable API endpoints before UI refinement.

Key design choices were made to manage project risk:

- Use FastAPI + Pydantic schemas to maintain a clear contract between frontend and backend.
- Represent performance metrics in a normalised but flexible table (`StatRecord`) to support adding metrics without schema redesign.
- Implement match capture constraints at the API layer to prevent inconsistent states.

---

## Chapter II: Background

### Context:

Volleyball performance data is inherently contextual. The value of an action depends on the training goal, opponent, and the phase of a season. As a result, a useful system must allow data to be recorded with enough context to support later interpretation (team, player, session, match set, rally order). Coaches also need workflows that are practical under time pressure, especially during matches, where recording speed and correction workflows are essential.

### Benefits of the application:

The system provides the following benefits:

- **Centralised data storage**: replaces fragmented spreadsheets with a consistent data model.
- **Faster analysis loops**: coaches can immediately view player charts after recording data.
- **Improved data quality**: validation rules in structured stat entry and match event prerequisites reduce invalid records.
- **Role‑based access**: supports organisational realities where analysts/admins may manage multiple teams while coaches are restricted to their own.
- **Scouting support**: enables comparison against teams in the same category, which is a common requirement in league preparation.

### User Target:

The primary target users are:

- **Coaches** who manage one or more teams and need to record and review training/match statistics.
- **Analysts** who may work across teams and need access to aggregated data and match capture.
- **Administrators** who manage the system, seed accounts, and have full access for maintenance.

### Impacts of the project and Context Review:

The project’s impact is the creation of a unified workflow that reduces the time cost of statistical record‑keeping while enabling more consistent evaluation of players. In a sports environment, this can support fairer selection decisions and more targeted training design. A system that standardises the way stats are recorded also improves the reliability of any downstream analytics models, because inputs are more consistent and traceable to sessions and teams.

### Agile & Rapid Application Development:

The project was developed iteratively. Early iterations focused on data modelling and CRUD endpoints, followed by frontend workflows for data entry and viewing. As development progressed, the approach resembled rapid application development for match capture and charting features, because these needed frequent feedback cycles to reduce friction in the UI and to align validation rules with real‑world use.

### Relevant Software & Tooling:

The primary technologies and tools used were:

- **Python / FastAPI** for backend API implementation.
- **SQLAlchemy** for ORM modelling of entities such as users, teams, sessions, and stat records.
- **Alembic** for database schema migrations and controlled evolution of the relational schema.
- **JWT authentication** with OAuth2 password flow for session tokens.
- **React (Vite)** for the frontend UI, state management, and API consumption.
- **Browser localStorage** for storing an access token for authenticated requests.

---

## Chapter III: Literature Review

Given the applied nature of this project, the most relevant literature and sources fall into three categories:

1. **Web application architecture and API design**: documentation and best practices for FastAPI, REST endpoint design, and schema validation in Pydantic.
2. **Authentication and authorization**: OAuth2 password flow patterns, JWT token structure, and practical role‑based access control.
3. **Sports analytics concepts**: definitions of volleyball actions and how they are commonly categorised for record‑keeping (attack, serve, reception, block), as well as principles of turning raw event counts into interpretable summaries for coaches.

While academic literature exists on volleyball analytics, the key engineering challenge here was not the discovery of novel metrics, but the creation of a robust system that can **store, retrieve, and present** data correctly, consistently, and securely.

---

## Chapter IV: Application Structure & Login

### System Architecture:

The system follows a client‑server model:

- The backend exposes a REST API that encapsulates all business rules and permission checks.
- The frontend calls the API and renders workflows for managing teams, sessions, and statistics.

This separation provides clear boundaries:

- The backend owns the source of truth and validation.
- The frontend focuses on usability and presentation.

### Backend (API) Structure:

The API is organised into routers that group endpoints by domain:

- `auth`: registration, token issuance, and “me” identity endpoint.
- `teams`, `players`, `sessions`: management of core domain entities.
- `stats`: detailed records, summary endpoints, and chart data endpoints.
- `match-stats`: lineups and match events (including undo).
- `scouting`: category‑constrained access to charts and insights.

The backend also defines:

- ORM models (`User`, `Team`, `Player`, `TrainingSession`, `StatRecord`, `MatchLineup`, `MatchPointEvent`).
- Pydantic schemas that define request/response contracts.
- Permission helpers that implement “who can manage which team” logic.

### Frontend Structure:

The frontend uses a central API client module that:

- stores the token in localStorage,
- attaches Authorization headers to requests,
- provides helper functions for each backend endpoint.

The primary user pages support:

- registering/logging in,
- selecting a team and creating sessions,
- recording statistics using structured forms,
- viewing per‑player charts and detail tables,
- recording match lineups and point events,
- viewing scouting‑oriented charts and insight outputs.

### Database Design:

The database is relational. Key relationships include:

- A `Team` can have many `Player` and many `TrainingSession`.
- A `TrainingSession` belongs to a team and can also reference an opponent team.
- A `StatRecord` links to a team and optionally to a player and session, enabling both general metrics and session‑scoped metrics.
- A `MatchLineup` and `MatchPointEvent` belong to a match session (a session where `is_match = true`).

The choice to store statistics as `(metric_key, value)` rows enables flexibility: new metrics can be added without changing the core table schema, while still retaining relational links to team/player/session.

### Login & Registration:

Authentication uses an OAuth2 password flow that issues a JWT access token. The token contains the username and role. The frontend stores the token and sends it with each request using the `Authorization: Bearer <token>` header. This enables the backend to identify the user and enforce role and team‑management rules.

### Account / Identity (“Me”) Endpoint:

The `/auth/me` endpoint returns the authenticated user identity and role. This supports frontend decisions such as showing only the teams the user can manage, and hiding restricted functionality from unauthorized roles.

---

## Chapter V: Teams, Players & Sessions

### Teams:

Teams represent the organisational container for all data. A team has:

- a name,
- category context (gender and competition),
- an optional `coach_id` link that assigns ownership to a coach.

Permission rules ensure:

- a coach sees only the teams they manage,
- analyst/admin roles can access all teams for operational and analysis purposes.

An additional opponent endpoint allows a coach to list opponents in the same category context for match setup, supporting consistent match metadata.

### Players:

Players belong to exactly one team and contain:

- first name, last name,
- optional position,
- optional jersey number.

Player lists are filtered by team in the frontend to support stat entry and chart rendering.

### Training Sessions:

Sessions store:

- date,
- optional type,
- optional notes,
- team association.

Sessions can be used as a context for recorded stats (e.g., “this training session’s serve outcomes”).

### Match Sessions (session-as-match):

Matches are modelled as sessions with `is_match = true`. A match can optionally include:

- opponent team reference.

This design reduces duplication in the database schema by reusing session logic while enabling match‑specific tables (lineups and point events) to attach only when required.

---

## Chapter VI: Statistics, Charts & Data Entry

### Data Model for Statistics:

The system uses a `StatRecord` table where each row stores:

- team id,
- optional player id,
- optional session id,
- metric key (e.g., `attack_point`, `serve_fault`),
- numeric value,
- metadata for who recorded it and when.

This approach supports both:

- **general stats**: not tied to a specific session,
- **session stats**: tied to a particular training session or match.

### Structured Stat Entry Workflow:

To reduce entry errors and enforce consistent naming, the frontend uses a structured “stat entry” form per category:

- Attack: points, faults, rally continues
- Reception: positive, double positive, fault
- Serve: points, faults, rally continues
- Block: blocks, blocks out

The backend validates that at least one count is non‑zero per entry. This prevents empty submissions that would add noise and improves the interpretability of summaries and charts.

### Detail Views and Filtering:

The system provides detailed stat logs that can be filtered by team, player, and session. This supports auditing and correction workflows where a coach needs to verify when and why a metric was recorded.

### Chart Generation:

Charts are generated per player and presented in two scopes:

- **General scope**: aggregates across all stats for the team.
- **Session scope**: aggregates only those stats recorded for a selected session.

This dual scope supports both longitudinal views (season trends) and focused views (performance in one match or training).

---

## Chapter VII: Match Statistics (Lineups, Events, Substitutions)

### Lineups by Set:

Before recording match events, the system requires that both “home” and “away” lineups are recorded for the set. Each lineup stores up to six jersey numbers plus optional naming. This mirrors the practical way teams are referenced during live match capture and simplifies event entry by enabling consistent player identification.

### Rally-by-rally Events:

Match events capture the flow of a set at the rally level using:

- set number,
- rally index,
- which side scored,
- event type (e.g., attack point, serve ace, opponent error),
- optional player number,
- substitution details where applicable (player in/out).

### Undo / Correction Workflow:

Live match capture inevitably requires corrections. The system includes an “undo last event” endpoint that removes the most recently recorded event for a match. This feature improves usability and reduces the incentive to leave incorrect data uncorrected.

### Data Quality Constraints:

The match endpoints implement strict constraints:

- events cannot be recorded unless lineups exist for both sides for that set,
- substitution events require both “player in” and “player out” fields.

These constraints are essential for maintaining consistent datasets that can support later analysis.

---

## Chapter VIII: Results and Evaluation

### Results:

The delivered system achieves the core outcomes defined in the objectives:

- Role‑based authentication and protected endpoints are implemented.
- Teams, players, and sessions can be managed through the API and the frontend.
- Statistics can be recorded using structured category forms, and retrieved in both detail and chart formats.
- Match capture workflows are available, including lineups per set, rally events, substitution tracking, and undo.
- A scouting module exists with category‑constrained access and insight outputs suitable for coaching interpretation.

### Evaluation:

From an engineering perspective, the system demonstrates:

- **Separation of concerns**: API enforces validation and permissions; frontend manages UX.
- **Extensibility**: new metrics can be introduced using new `metric_key` values without schema redesign.
- **Usability under constraints**: match capture includes validation and an undo feature, reducing friction.
- **Security posture**: token‑based auth and permission checks are applied on protected routes.

From a user‑workflow perspective, the application supports realistic coaching tasks and prioritises fast access to charts and summaries after entry.

### Shortcomings:

The current implementation also has limitations:

- **Reporting depth**: charts are focused on totals; rate‑based metrics (e.g., success rates) and confidence intervals are not consistently exposed in the UI.
- **Data governance**: there is no explicit audit UI for edits (beyond created timestamps), and deletion/editing flows may need improvement for real organisations.
- **Scalability**: while the API is structured, additional indexing, pagination, and caching may be required for larger datasets.
- **Role granularity**: roles are implemented, but future systems often require more fine‑grained permissions (e.g., assistant coach access, read-only roles).

---

## Chapter IX: Conclusions and Future Work

### Conclusions:

This project successfully delivers a functioning full‑stack volleyball performance data platform. The system supports core coaching workflows while enforcing permission boundaries and data quality constraints. The combination of session context, flexible stat storage, and match event capture provides a strong foundation for deeper analytics and scouting capabilities.

### Future Work:

The following improvements are recommended:

- **Expanded analytics**: add derived metrics (rates, efficiencies), session‑to‑session comparisons, and trend visualisations.
- **Editing workflows**: add controlled update/delete features for stat records and match events, with explicit audit logging.
- **UX refinement for match capture**: introduce faster keyboard‑driven entry and batch event capture to support real-time analysis.
- **Data exports**: provide CSV export per team/player/session to support external analysis in Python/R.
- **Model transparency in scouting**: explain insight generation in the UI and provide confidence indicators (attempt thresholds).
- **Deployment hardening**: environment configuration, secure CORS policies, and production database configuration.
- **Testing and CI**: expand automated tests for permissions, validation, and match constraints.

---

## References & Bibliography:

- FastAPI Documentation. (2026). FastAPI. Available at: `https://fastapi.tiangolo.com/`
- Pydantic Documentation. (2026). Pydantic. Available at: `https://docs.pydantic.dev/`
- SQLAlchemy Documentation. (2026). SQLAlchemy. Available at: `https://docs.sqlalchemy.org/`
- Alembic Documentation. (2026). Alembic. Available at: `https://alembic.sqlalchemy.org/`
- OAuth 2.0. (2012). The OAuth 2.0 Authorization Framework (RFC 6749).
- JSON Web Token. (2015). JSON Web Token (JWT) (RFC 7519).
- React Documentation. (2026). React. Available at: `https://react.dev/`

---

## Appendices:

### Appendix A: Entity Overview (high level)

- **User**: identity + role (coach/analyst/admin).
- **Team**: volleyball team with category context and optional coach ownership.
- **Player**: roster member linked to a team.
- **TrainingSession**: training or match context linked to a team.
- **StatRecord**: flexible metric storage linked to team/player/session.
- **MatchLineup**: set lineup for a match session (home/away).
- **MatchPointEvent**: rally events including substitutions, linked to match session.

### Appendix B: Suggested figures (to be added)

- Figure 1: System architecture (frontend ↔ API ↔ database).
- Figure 2: ER diagram (User, Team, Player, Session, StatRecord, MatchLineup, MatchPointEvent).
- Figure 3: Main UI screens (Teams, Players, Sessions, Stats, Match Stats, Scouting).
- Figure 4: Match capture flow (lineups → events → undo).

