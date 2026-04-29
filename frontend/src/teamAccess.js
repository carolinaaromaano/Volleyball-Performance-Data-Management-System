export function canManageTeam(team, user) {
  if (!user) return false;
  if (user.role === "analyst" || user.role === "admin") return true;
  if (user.role !== "coach") return false;
  if (team.coach_id == null) return true;
  return Number(team.coach_id) === Number(user.id);
}
