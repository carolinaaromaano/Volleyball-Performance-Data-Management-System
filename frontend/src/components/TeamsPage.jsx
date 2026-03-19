import React, { useEffect, useMemo, useState } from "react";
import { clearToken, fetchTeams, createTeam, fetchMe } from "../api/client.js";

export default function TeamsPage() {
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");

  const canCreate = useMemo(() => name.trim().length > 0, [name]);

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      const [meData, teamsData] = await Promise.all([fetchMe(), fetchTeams()]);
      setMe(meData);
      setTeams(teamsData);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await createTeam({
        name: name.trim(),
        category: category.trim() ? category.trim() : null,
      });
      setName("");
      setCategory("");
      await reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  function onLogout() {
    clearToken();
    window.location.reload();
  }

  return (
    <div className="card">
      <div className="row" style={{ alignItems: "baseline", marginBottom: 14 }}>
        <h2 className="title" style={{ margin: 0 }}>Teams</h2>
        {me ? (
          <div className="muted" style={{ fontSize: 14 }}>
            Logged in as <b>{me.username}</b> ({me.role})
          </div>
        ) : null}
        <div className="spacer">
          <button className="btn-ghost" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <form onSubmit={onCreate} style={{ marginBottom: 20 }}>
        <div className="grid-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Category (optional)</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button className="btn" disabled={!canCreate || loading} type="submit">
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>

      {loading ? <div>Loading...</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.name}</td>
              <td>{t.category ?? "-"}</td>
            </tr>
          ))}
          {teams.length === 0 && !loading ? (
            <tr>
              <td colSpan="3" style={{ textAlign: "center", opacity: 0.7 }}>
                No teams yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

