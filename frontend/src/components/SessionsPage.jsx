import React, { useEffect, useMemo, useState } from "react";
import {
  createSession,
  fetchOpponentTeams,
  fetchSessions,
  fetchTeams,
} from "../api/client.js";
import { formatTeamExtra } from "../teamLabels.js";

function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function SessionsPage() {
  const [teams, setTeams] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filterTeamId, setFilterTeamId] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState("training"); // training | match
  const [date, setDate] = useState(todayISODate);
  const [type, setType] = useState("");
  const [notes, setNotes] = useState("");
  const [teamId, setTeamId] = useState("");
  const [opponentTeamId, setOpponentTeamId] = useState("");
  const [opponentTeams, setOpponentTeams] = useState([]);

  const canCreate = useMemo(() => {
    if (!date || teamId === "") return false;
    if (mode === "match") return opponentTeamId !== "";
    return true;
  }, [date, teamId, mode, opponentTeamId]);

  const teamsById = useMemo(() => {
    const m = new Map();
    teams.forEach((t) => m.set(Number(t.id), t));
    return m;
  }, [teams]);

  const selectedTeam = useMemo(() => {
    if (!teamId) return null;
    return teamsById.get(Number(teamId)) || null;
  }, [teamId, teamsById]);

  const opponentOptions = useMemo(() => opponentTeams, [opponentTeams]);

  useEffect(() => {
    if (!teamId || mode !== "match") {
      setOpponentTeams([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchOpponentTeams(Number(teamId));
        if (!cancelled) setOpponentTeams(rows);
      } catch {
        if (!cancelled) setOpponentTeams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, mode]);

  async function reloadLists() {
    setError(null);
    setLoading(true);
    try {
      const teamsData = await fetchTeams();
      setTeams(teamsData);
      const filters =
        filterTeamId === "" ? {} : { team_id: Number(filterTeamId) };
      const sessionsData = await fetchSessions(filters);
      setSessions(sessionsData);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadLists();
  }, [filterTeamId]);

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createSession({
        date,
        type: mode === "match" ? "match" : type,
        notes,
        team_id: teamId,
        is_match: mode === "match",
        opponent_team_id: mode === "match" ? opponentTeamId : null,
      });
      setOpponentTeamId("");
      setType("");
      setNotes("");
      setDate(todayISODate());
      await reloadLists();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="title" style={{ marginTop: 0 }}>
        Sessions and matches
      </h2>

      <div className="field" style={{ maxWidth: 280 }}>
        <label>Filter by team</label>
        <select
          value={filterTeamId}
          onChange={(e) => setFilterTeamId(e.target.value)}
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {formatTeamExtra(t)} (#{t.id})
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={onCreate} style={{ marginTop: 16, marginBottom: 20 }}>
        <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
          Create training session or match
        </p>

        <div className="field" style={{ maxWidth: 360 }}>
          <label>Entry type</label>
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setOpponentTeamId("");
            }}
          >
            <option value="training">Training session</option>
            <option value="match">Match</option>
          </select>
        </div>

        <div className="grid-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{mode === "match" ? "Label (optional)" : "Type (optional)"}</label>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={mode === "match" ? "e.g. league" : "e.g. technical"}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Notes (optional)</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Team</label>
          <select
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              setOpponentTeamId("");
            }}
            required
          >
            <option value="">Select team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {formatTeamExtra(t)} (#{t.id})
              </option>
            ))}
          </select>
        </div>

        {mode === "match" ? (
          <div className="field" style={{ marginTop: 12 }}>
            <label>Opponent team (same category)</label>
            <select
              value={opponentTeamId}
              onChange={(e) => setOpponentTeamId(e.target.value)}
              required
              disabled={!teamId}
            >
              <option value="">
                {teamId ? "Select opponent" : "Select your team first"}
              </option>
              {opponentOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {formatTeamExtra(t)} (#{t.id})
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div style={{ marginTop: 12 }}>
          <button className="btn" disabled={!canCreate || loading} type="submit">
            {loading ? "Saving..." : mode === "match" ? "Create match" : "Create session"}
          </button>
        </div>
      </form>

      {loading ? <div className="muted">Loading...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Date</th>
            <th>Kind</th>
            <th>Opponent</th>
            <th>Team ID</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.date}</td>
              <td>{s.is_match ? "Match" : "Training"}</td>
              <td>
                {s.is_match && s.opponent_team_id
                  ? teamsById.get(Number(s.opponent_team_id))?.name ??
                    `#${s.opponent_team_id}`
                  : "—"}
              </td>
              <td>{s.team_id}</td>
              <td className="muted" style={{ fontSize: 13 }}>
                {s.created_at
                  ? new Date(s.created_at).toLocaleString()
                  : "-"}
              </td>
            </tr>
          ))}
          {sessions.length === 0 && !loading ? (
            <tr>
              <td colSpan="6" style={{ textAlign: "center", opacity: 0.7 }}>
                No sessions or matches yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
