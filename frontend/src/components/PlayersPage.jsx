import React, { useEffect, useMemo, useState } from "react";
import {
  createPlayer,
  fetchPlayers,
  fetchTeams,
} from "../api/client.js";
import { formatTeamExtra } from "../teamLabels.js";

export default function PlayersPage() {
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [filterTeamId, setFilterTeamId] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [teamId, setTeamId] = useState("");

  const canCreate = useMemo(
    () =>
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      teamId !== "",
    [firstName, lastName, teamId]
  );

  async function reloadLists() {
    setError(null);
    setLoading(true);
    try {
      const teamsData = await fetchTeams();
      setTeams(teamsData);
      const filters =
        filterTeamId === "" ? {} : { team_id: Number(filterTeamId) };
      const playersData = await fetchPlayers(filters);
      setPlayers(playersData);
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
      await createPlayer({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        position,
        number,
        team_id: teamId,
      });
      setFirstName("");
      setLastName("");
      setPosition("");
      setNumber("");
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
        Players
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
          Create player
        </p>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>First name</label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Last name</label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Position (optional)</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Number (optional)</label>
            <input
              type="number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Team</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
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
        <div style={{ marginTop: 12 }}>
          <button className="btn" disabled={!canCreate || loading} type="submit">
            {loading ? "Saving..." : "Create player"}
          </button>
        </div>
      </form>

      {loading ? <div className="muted">Loading...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Position</th>
            <th>#</th>
            <th>Team ID</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>
                {p.first_name} {p.last_name}
              </td>
              <td>{p.position ?? "-"}</td>
              <td>{p.number ?? "-"}</td>
              <td>{p.team_id}</td>
            </tr>
          ))}
          {players.length === 0 && !loading ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", opacity: 0.7 }}>
                No players yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
