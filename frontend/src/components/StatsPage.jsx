import React, { useEffect, useMemo, useState } from "react";
import {
  createStatEntry,
  fetchMe,
  fetchPlayers,
  fetchSessions,
  fetchStatsDetail,
  fetchTeamPlayerChartData,
  fetchTeams,
} from "../api/client.js";
import PlayerStatChartsCard from "./PlayerStatChartsCard.jsx";
import { formatTeamExtra } from "../teamLabels.js";
import { canManageTeam } from "../teamAccess.js";

const METRIC_LABELS = {
  attack_point: "Attack · point",
  attack_fault: "Attack · fault",
  attack_rally_continue: "Attack · rally continues",
  reception_positive: "Reception · positive",
  reception_double_positive: "Reception · double positive",
  reception_fault: "Reception · fault",
  serve_point: "Serve · point",
  serve_fault: "Serve · fault",
  serve_rally_continue: "Serve · rally continues",
  block: "Block",
  block_out: "Block · out",
};

function metricLabel(key) {
  return METRIC_LABELS[key] || key;
}

function playerLabel(players, id) {
  if (id == null) return "—";
  const pid = Number(id);
  const p = players.find((x) => Number(x.id) === pid);
  return p ? `${p.first_name} ${p.last_name}` : `#${id}`;
}

export default function StatsPage() {
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState([]);
  const [chartTeamId, setChartTeamId] = useState("");
  const [chartScope, setChartScope] = useState("general");
  const [chartSessionId, setChartSessionId] = useState("");
  const [chartSessions, setChartSessions] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [manageTeamId, setManageTeamId] = useState("");
  const [detailRows, setDetailRows] = useState([]);
  const [players, setPlayers] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [category, setCategory] = useState("attack");
  const [playerId, setPlayerId] = useState("");
  const [statScope, setStatScope] = useState("general");
  const [sessionId, setSessionId] = useState("");

  const [attackPoints, setAttackPoints] = useState("");
  const [attackFaults, setAttackFaults] = useState("");
  const [attackRallyContinues, setAttackRallyContinues] = useState("");

  const [receptionPositives, setReceptionPositives] = useState("");
  const [receptionDoublePositives, setReceptionDoublePositives] = useState("");
  const [receptionFaults, setReceptionFaults] = useState("");

  const [servePoints, setServePoints] = useState("");
  const [serveFaults, setServeFaults] = useState("");
  const [serveRallyContinues, setServeRallyContinues] = useState("");

  const [blocks, setBlocks] = useState("");
  const [blocksOut, setBlocksOut] = useState("");

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const managedTeams = useMemo(() => {
    if (!me) return [];
    return teams.filter((t) => canManageTeam(t, me));
  }, [teams, me]);

  async function bootstrap() {
    setError(null);
    setLoading(true);
    try {
      const [user, teamsData] = await Promise.all([fetchMe(), fetchTeams()]);
      setMe(user);
      setTeams(teamsData);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!manageTeamId) {
      setPlayers([]);
      setSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([
          fetchPlayers({ team_id: Number(manageTeamId) }),
          fetchSessions({ team_id: Number(manageTeamId) }),
        ]);
        if (!cancelled) {
          setPlayers(p);
          setSessions(s);
        }
      } catch {
        if (!cancelled) {
          setPlayers([]);
          setSessions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [manageTeamId]);

  const trainingSessions = useMemo(
    () => sessions.filter((s) => !s.is_match),
    [sessions]
  );

  const matchSessions = useMemo(
    () => sessions.filter((s) => s.is_match),
    [sessions]
  );

  useEffect(() => {
    if (!chartTeamId) {
      setChartSessions([]);
      setChartSessionId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSessions({ team_id: Number(chartTeamId) });
        if (!cancelled) {
          setChartSessions(s);
        }
      } catch {
        if (!cancelled) {
          setChartSessions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chartTeamId]);

  async function refreshCharts() {
    if (!chartTeamId) return;
    const tid = Number(chartTeamId);
    const sid =
      chartScope === "session" && chartSessionId
        ? Number(chartSessionId)
        : null;
    const data = await fetchTeamPlayerChartData(tid, {
      trainingSessionId: sid,
    });
    setChartData(data);
  }

  async function onLoadCharts(e) {
    e.preventDefault();
    if (!chartTeamId) {
      setError("Select a team.");
      return;
    }
    if (chartScope === "session" && !chartSessionId) {
      setError("Select a session.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await refreshCharts();
    } catch (err) {
      setError(err.message || String(err));
      setChartData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail() {
    if (!manageTeamId) return;
    setError(null);
    setLoading(true);
    try {
      const rows = await fetchStatsDetail({ team_id: Number(manageTeamId) });
      setDetailRows(rows);
    } catch (err) {
      setError(err.message || String(err));
      setDetailRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function onSaveEntry(e) {
    e.preventDefault();
    if (!manageTeamId) {
      setError("Select a team.");
      return;
    }
    if (!playerId) {
      setError("Select a player.");
      return;
    }
    if (statScope !== "general" && !sessionId) {
      setError("Select a session for this entry.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await createStatEntry({
        team_id: manageTeamId,
        player_id: playerId,
        training_session_id:
          statScope === "general" ? null : sessionId === "" ? null : sessionId,
        category,
        attack_points: attackPoints,
        attack_faults: attackFaults,
        attack_rally_continues: attackRallyContinues,
        reception_positives: receptionPositives,
        reception_double_positives: receptionDoublePositives,
        reception_faults: receptionFaults,
        serve_points: servePoints,
        serve_faults: serveFaults,
        serve_rally_continues: serveRallyContinues,
        blocks,
        blocks_out: blocksOut,
      });
      setAttackPoints("");
      setAttackFaults("");
      setAttackRallyContinues("");
      setReceptionPositives("");
      setReceptionDoublePositives("");
      setReceptionFaults("");
      setServePoints("");
      setServeFaults("");
      setServeRallyContinues("");
      setBlocks("");
      setBlocksOut("");
      await loadDetail();
      if (chartTeamId && Number(chartTeamId) === Number(manageTeamId)) {
        try {
          await refreshCharts();
        } catch {
        }
      }
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="title" style={{ marginTop: 0 }}>
        Statistics
      </h2>
      <p className="muted" style={{ marginBottom: 20 }}>
        View per-player charts (attack, serve, reception, block) for teams you
        manage—either across all data or filtered by one session (training or
        match). Below,
        record new stats for your teams.
      </p>

      {error ? (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          <div className="alert-icon" aria-hidden="true">
            !
          </div>
          <div>
            <p className="alert-title">Something went wrong</p>
            <p className="alert-text">{error}</p>
          </div>
        </div>
      ) : null}
      {loading ? <div className="muted">Loading...</div> : null}

      <section style={{ marginBottom: 32 }}>
        <h3 className="title" style={{ fontSize: 18 }}>
          Team statistics (charts)
        </h3>
        {!managedTeams.length ? (
          <p className="muted">
            Create a team under Teams to view player charts for that roster.
          </p>
        ) : (
          <>
            <form onSubmit={onLoadCharts}>
              <div className="field" style={{ maxWidth: 360 }}>
                <label>Team</label>
                <select
                  value={chartTeamId}
                  onChange={(e) => {
                    setChartTeamId(e.target.value);
                    setChartData(null);
                  }}
                >
                  <option value="">Select team</option>
                  {managedTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {formatTeamExtra(t)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 8 }}>
                <label>View</label>
                <div className="toggle-tabs" role="tablist" aria-label="Chart view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartScope === "general"}
                    className={`toggle-tab ${
                      chartScope === "general" ? "toggle-tab-active" : ""
                    }`}
                    onClick={() => {
                      setChartScope("general");
                      setChartSessionId("");
                      setChartData(null);
                    }}
                  >
                    General
                    <span className="toggle-tab-sub">All sessions</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={chartScope === "session"}
                    className={`toggle-tab ${
                      chartScope === "session" ? "toggle-tab-active" : ""
                    }`}
                    onClick={() => {
                      setChartScope("session");
                      setChartData(null);
                    }}
                  >
                    By session
                    <span className="toggle-tab-sub">Pick one session</span>
                  </button>
                </div>
              </div>

              {chartScope === "session" ? (
                <div className="field" style={{ maxWidth: 360 }}>
                  <label>Training session</label>
                  <select
                    value={chartSessionId}
                    onChange={(e) => {
                      setChartSessionId(e.target.value);
                      setChartData(null);
                    }}
                  >
                    <option value="">Select session</option>
                    {chartSessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.date}
                        {s.type ? ` · ${s.type}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div style={{ marginTop: 8 }}>
                <button
                  className="btn"
                  type="submit"
                  disabled={!chartTeamId || loading}
                >
                  Load charts
                </button>
              </div>
            </form>

            {chartData ? (
              <div style={{ marginTop: 8 }}>
                <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
                  Scope:{" "}
                  <strong>
                    {chartData.scope === "session"
                      ? "Selected session"
                      : "All sessions"}
                  </strong>
                  {chartData.training_session_id != null
                    ? ` · Session #${chartData.training_session_id}`
                    : ""}
                </p>
                {chartData.players?.length ? (
                  chartData.players.map((p) => (
                    <PlayerStatChartsCard key={p.player_id} player={p} />
                  ))
                ) : (
                  <p className="muted">No players on this roster yet.</p>
                )}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section>
        <h3 className="title" style={{ fontSize: 18 }}>
          Your teams: detail and entry
        </h3>
        {!managedTeams.length ? (
          <p className="muted">Create a team under Teams to record statistics.</p>
        ) : (
          <>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Team</label>
              <select
                value={manageTeamId}
                onChange={(e) => setManageTeamId(e.target.value)}
              >
                <option value="">—</option>
                {managedTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {formatTeamExtra(t)}
                  </option>
                ))}
              </select>
            </div>
            {manageTeamId ? (
              <>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ marginTop: 8 }}
                  onClick={() => loadDetail()}
                  disabled={loading}
                >
                  Load detail
                </button>

                <form onSubmit={onSaveEntry} style={{ marginTop: 20 }}>
                  <div className="field" style={{ maxWidth: 360 }}>
                    <label>Player</label>
                    <select
                      value={playerId}
                      onChange={(e) => setPlayerId(e.target.value)}
                      required
                    >
                      <option value="">Select player</option>
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                          {p.number != null ? ` (#${p.number})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ maxWidth: 360 }}>
                    <label>Stat category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="attack">Attack</option>
                      <option value="reception">Reception</option>
                      <option value="serve">Serve</option>
                      <option value="block">Block</option>
                    </select>
                  </div>

                  <div className="field" style={{ maxWidth: 360 }}>
                    <label>Record for</label>
                    <select
                      value={statScope}
                      onChange={(e) => {
                        const next = e.target.value;
                        setStatScope(next);
                        setSessionId("");
                      }}
                    >
                      <option value="general">General (no session)</option>
                      <option value="training">Training session</option>
                      <option value="match">Match</option>
                    </select>
                  </div>

                  {statScope !== "general" ? (
                    <div className="field" style={{ maxWidth: 360 }}>
                      <label>
                        {statScope === "match"
                          ? "Match session"
                          : "Training session"}
                      </label>
                      <select
                        value={sessionId}
                        onChange={(e) => setSessionId(e.target.value)}
                        required
                      >
                        <option value="">Select session</option>
                        {(statScope === "match"
                          ? matchSessions
                          : trainingSessions
                        ).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.date} {s.type ? `· ${s.type}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {category === "attack" ? (
                    <div className="grid-2">
                      <div className="field">
                        <label>Points (kills / direct points)</label>
                        <input
                          type="number"
                          min={0}
                          value={attackPoints}
                          onChange={(e) => setAttackPoints(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Faults</label>
                        <input
                          type="number"
                          min={0}
                          value={attackFaults}
                          onChange={(e) => setAttackFaults(e.target.value)}
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Rally continues (in play, no point)</label>
                        <input
                          type="number"
                          min={0}
                          value={attackRallyContinues}
                          onChange={(e) => setAttackRallyContinues(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {category === "reception" ? (
                    <div className="grid-2">
                      <div className="field">
                        <label>Positive</label>
                        <input
                          type="number"
                          min={0}
                          value={receptionPositives}
                          onChange={(e) => setReceptionPositives(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Double positive</label>
                        <input
                          type="number"
                          min={0}
                          value={receptionDoublePositives}
                          onChange={(e) =>
                            setReceptionDoublePositives(e.target.value)
                          }
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Faults</label>
                        <input
                          type="number"
                          min={0}
                          value={receptionFaults}
                          onChange={(e) => setReceptionFaults(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {category === "serve" ? (
                    <div className="grid-2">
                      <div className="field">
                        <label>Points (aces / direct points)</label>
                        <input
                          type="number"
                          min={0}
                          value={servePoints}
                          onChange={(e) => setServePoints(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Faults</label>
                        <input
                          type="number"
                          min={0}
                          value={serveFaults}
                          onChange={(e) => setServeFaults(e.target.value)}
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "1 / -1" }}>
                        <label>Rally continues (in play, no point)</label>
                        <input
                          type="number"
                          min={0}
                          value={serveRallyContinues}
                          onChange={(e) => setServeRallyContinues(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  {category === "block" ? (
                    <div className="grid-2">
                      <div className="field">
                        <label>Blocks</label>
                        <input
                          type="number"
                          min={0}
                          value={blocks}
                          onChange={(e) => setBlocks(e.target.value)}
                        />
                      </div>
                      <div className="field">
                        <label>Blocks out</label>
                        <input
                          type="number"
                          min={0}
                          value={blocksOut}
                          onChange={(e) => setBlocksOut(e.target.value)}
                        />
                      </div>
                    </div>
                  ) : null}

                  <button className="btn" type="submit" disabled={loading}>
                    Save statistics
                  </button>
                </form>

                {detailRows.length ? (
                  <table style={{ marginTop: 16 }}>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Metric</th>
                        <th>Value</th>
                        <th>Player</th>
                        <th>Session</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailRows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.created_at?.slice(0, 19) || "—"}</td>
                          <td>{metricLabel(r.metric_key)}</td>
                          <td>{r.value}</td>
                          <td>{playerLabel(players, r.player_id)}</td>
                          <td>{r.training_session_id ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
