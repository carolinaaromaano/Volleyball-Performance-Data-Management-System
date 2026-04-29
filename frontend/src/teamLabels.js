export const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

export const COMPETITION_OPTIONS = [
  { value: "national_league", label: "National League" },
  { value: "division_2", label: "Division 2" },
  { value: "regional_leagues", label: "Regional Leagues" },
];

const genderLabel = (v) =>
  GENDER_OPTIONS.find((o) => o.value === v)?.label ?? v ?? "";

const competitionLabel = (v) =>
  COMPETITION_OPTIONS.find((o) => o.value === v)?.label ?? v ?? "";

export function formatTeamExtra(t) {
  if (!t) return "";
  const bits = [];
  if (t.gender) bits.push(genderLabel(t.gender));
  if (t.competition) bits.push(competitionLabel(t.competition));
  if (bits.length) return ` (${bits.join(" · ")})`;
  if (t.category) return ` (${t.category})`;
  return "";
}
