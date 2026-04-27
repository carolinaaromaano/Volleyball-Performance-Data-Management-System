const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const TOKEN_KEY = "vp_token";

async function readApiError(res) {
  // Try JSON first (FastAPI usually returns {"detail": "..."}).
  try {
    const data = await res.json();
    if (data && typeof data === "object") {
      if (typeof data.detail === "string") return data.detail;
      if (typeof data.message === "string") return data.message;
    }
    return JSON.stringify(data);
  } catch {
    // Fallback to plain text.
    try {
      const text = await res.text();
      // Sometimes an API returns JSON-as-text; unwrap {"detail": "..."} if so.
      const trimmed = (text || "").trim();
      if (trimmed.startsWith("{") && trimmed.includes("\"detail\"")) {
        try {
          const data = JSON.parse(trimmed);
          if (data && typeof data.detail === "string") return data.detail;
        } catch {
          // ignore
        }
      }
      return text || `${res.status} ${res.statusText}`;
    } catch {
      return `${res.status} ${res.statusText}`;
    }
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function withAuthHeaders() {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function registerCoach(username, password) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function login(username, password) {
  // OAuth2PasswordRequestForm expects x-www-form-urlencoded
  const body = new URLSearchParams();
  body.append("username", username);
  body.append("password", password);

  const res = await fetch(`${API_BASE_URL}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      ...withAuthHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function fetchTeams() {
  const res = await fetch(`${API_BASE_URL}/teams`, {
    headers: {
      ...withAuthHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function fetchOpponentTeams(teamId) {
  const res = await fetch(`${API_BASE_URL}/teams/${teamId}/opponents`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function createTeam(team) {
  const res = await fetch(`${API_BASE_URL}/teams`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(),
    },
    body: JSON.stringify(team),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function deleteTeam(teamId) {
  const res = await fetch(`${API_BASE_URL}/teams/${teamId}`, {
    method: "DELETE",
    headers: {
      ...withAuthHeaders(),
    },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}

function buildQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      q.set(k, String(v));
    }
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchPlayers(filters = {}) {
  const qs = buildQuery({
    team_id: filters.team_id,
    position: filters.position,
  });
  const res = await fetch(`${API_BASE_URL}/players${qs}`, {
    headers: { ...withAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function createPlayer(player) {
  const body = {
    first_name: player.first_name,
    last_name: player.last_name,
    position: player.position?.trim() ? player.position.trim() : null,
    number:
      player.number === "" || player.number == null
        ? null
        : Number(player.number),
    team_id: Number(player.team_id),
  };

  const res = await fetch(`${API_BASE_URL}/players`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function fetchSessions(filters = {}) {
  const qs = buildQuery({
    team_id: filters.team_id,
    date_from: filters.date_from,
    date_to: filters.date_to,
    type: filters.type,
  });
  const res = await fetch(`${API_BASE_URL}/sessions${qs}`, {
    headers: { ...withAuthHeaders() },
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function createSession(session) {
  const body = {
    date: session.date,
    type: session.type?.trim() ? session.type.trim() : null,
    notes: session.notes?.trim() ? session.notes.trim() : null,
    team_id: Number(session.team_id),
    is_match: Boolean(session.is_match),
    opponent_team_id:
      session.opponent_team_id === "" || session.opponent_team_id == null
        ? null
        : Number(session.opponent_team_id),
  };

  const res = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return res.json();
}

export async function fetchStatsDetail(filters = {}) {
  const qs = buildQuery({
    team_id: filters.team_id,
    player_id: filters.player_id,
    training_session_id: filters.training_session_id,
    skip: filters.skip,
    limit: filters.limit,
  });
  const res = await fetch(`${API_BASE_URL}/stats${qs}`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function fetchTeamStatsSummary(teamId) {
  const res = await fetch(`${API_BASE_URL}/stats/teams/${teamId}/summary`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

/** Per-player totals for charts (general or filtered by training session). */
export async function fetchTeamPlayerChartData(teamId, { trainingSessionId } = {}) {
  const qs = buildQuery({
    training_session_id:
      trainingSessionId === "" || trainingSessionId == null
        ? undefined
        : trainingSessionId,
  });
  const res = await fetch(
    `${API_BASE_URL}/stats/teams/${teamId}/players-chart${qs}`,
    { headers: { ...withAuthHeaders() } }
  );
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function createStat(stat) {
  const body = {
    team_id: Number(stat.team_id),
    player_id:
      stat.player_id === "" || stat.player_id == null
        ? null
        : Number(stat.player_id),
    training_session_id:
      stat.training_session_id === "" || stat.training_session_id == null
        ? null
        : Number(stat.training_session_id),
    metric_key: stat.metric_key.trim(),
    value: Number(stat.value),
  };
  const res = await fetch(`${API_BASE_URL}/stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

/** Structured stat entry (player + category + counts). */
export async function createStatEntry(entry) {
  const body = {
    team_id: Number(entry.team_id),
    player_id: Number(entry.player_id),
    training_session_id:
      entry.training_session_id === "" ||
      entry.training_session_id == null
        ? null
        : Number(entry.training_session_id),
    category: entry.category,
    attack_points: Number(entry.attack_points) || 0,
    attack_faults: Number(entry.attack_faults) || 0,
    attack_rally_continues: Number(entry.attack_rally_continues) || 0,
    reception_positives: Number(entry.reception_positives) || 0,
    reception_double_positives: Number(entry.reception_double_positives) || 0,
    reception_faults: Number(entry.reception_faults) || 0,
    serve_points: Number(entry.serve_points) || 0,
    serve_faults: Number(entry.serve_faults) || 0,
    serve_rally_continues: Number(entry.serve_rally_continues) || 0,
    blocks: Number(entry.blocks) || 0,
    blocks_out: Number(entry.blocks_out) || 0,
  };
  const res = await fetch(`${API_BASE_URL}/stats/entry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...withAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function fetchMatchLineups(matchSessionId) {
  const res = await fetch(`${API_BASE_URL}/match-stats/${matchSessionId}/lineups`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function saveMatchLineup(matchSessionId, side, lineup) {
  const body = {
    training_session_id: Number(matchSessionId),
    side,
    set_number: Number(lineup.set_number) || 1,
    team_name: lineup.team_name?.trim() ? lineup.team_name.trim() : null,
    p1: lineup.p1 === "" || lineup.p1 == null ? null : Number(lineup.p1),
    p2: lineup.p2 === "" || lineup.p2 == null ? null : Number(lineup.p2),
    p3: lineup.p3 === "" || lineup.p3 == null ? null : Number(lineup.p3),
    p4: lineup.p4 === "" || lineup.p4 == null ? null : Number(lineup.p4),
    p5: lineup.p5 === "" || lineup.p5 == null ? null : Number(lineup.p5),
    p6: lineup.p6 === "" || lineup.p6 == null ? null : Number(lineup.p6),
  };
  const res = await fetch(
    `${API_BASE_URL}/match-stats/${matchSessionId}/lineups/${side}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...withAuthHeaders() },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function fetchMatchEvents(matchSessionId) {
  const res = await fetch(`${API_BASE_URL}/match-stats/${matchSessionId}/events`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function addMatchEvent(matchSessionId, event) {
  const body = {
    training_session_id: Number(matchSessionId),
    set_number: Number(event.set_number),
    rally_index: Number(event.rally_index),
    scoring_side: event.scoring_side,
    event_type: event.event_type,
    player_number:
      event.player_number === "" || event.player_number == null
        ? null
        : Number(event.player_number),
    player_in_number:
      event.player_in_number === "" || event.player_in_number == null
        ? null
        : Number(event.player_in_number),
    player_out_number:
      event.player_out_number === "" || event.player_out_number == null
        ? null
        : Number(event.player_out_number),
  };
  const res = await fetch(`${API_BASE_URL}/match-stats/${matchSessionId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...withAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function undoLastMatchEvent(matchSessionId) {
  const res = await fetch(
    `${API_BASE_URL}/match-stats/${matchSessionId}/events/last`,
    { method: "DELETE", headers: { ...withAuthHeaders() } }
  );
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function fetchScoutingTeams({ gender, competition }) {
  const qs = buildQuery({ gender, competition });
  const res = await fetch(`${API_BASE_URL}/scouting/teams${qs}`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function fetchScoutingTeamCharts(teamId, { trainingSessionId } = {}) {
  const qs = buildQuery({
    training_session_id:
      trainingSessionId === "" || trainingSessionId == null
        ? undefined
        : trainingSessionId,
  });
  const res = await fetch(
    `${API_BASE_URL}/scouting/teams/${teamId}/players-chart${qs}`,
    { headers: { ...withAuthHeaders() } }
  );
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}

export async function fetchScoutingTeamInsights(teamId) {
  const res = await fetch(`${API_BASE_URL}/scouting/teams/${teamId}/insights`, {
    headers: { ...withAuthHeaders() },
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  return res.json();
}
