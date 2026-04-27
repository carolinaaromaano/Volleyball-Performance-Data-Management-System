from sqlalchemy.orm import Session

from . import models

# Roles allowed to call coach/analyst API routes (teams, players, sessions, stats).
API_STAFF_ROLES = [
    models.RoleEnum.COACH.value,
    models.RoleEnum.ANALYST.value,
    models.RoleEnum.ADMIN.value,
]


def user_role_str(user: models.User) -> str:
    r = user.role
    if isinstance(r, str):
        return r
    return getattr(r, "value", str(r))


def is_coach(user: models.User) -> bool:
    return user_role_str(user) == models.RoleEnum.COACH.value


def can_manage_team(db: Session, user: models.User, team_id: int) -> bool:
    role = user_role_str(user)
    if role in (
        models.RoleEnum.ANALYST.value,
        models.RoleEnum.ADMIN.value,
    ):
        return True
    team = db.query(models.Team).filter(models.Team.id == team_id).first()
    if not team:
        return False
    if role != models.RoleEnum.COACH.value:
        return False
    if team.coach_id is None:
        return True
    return int(team.coach_id) == int(user.id)
