import React, { useEffect, useMemo, useState } from "react";
import {
  fetchMe,
  fetchScoutingTeamCharts,
  fetchScoutingTeamInsights,
  fetchScoutingTeams,
} from "../api/client.js";
import PlayerStatChartsCard from "./PlayerStatChartsCard.jsx";
import { COMPETITION_OPTIONS, GENDER_OPTIONS, formatTeamExtra } from "../teamLabels.js";

export default function ScoutingPage() {
  const [me, setMe] = useState(null);
  const [gender, setGender] = useState("female");
  const [competition, setCompetition] = useState("national_league");
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [chartData, setChartData] = useState(null);
  const [insights, setInsights] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const selectedTeam = useMemo(
    () => teams.find((t) => String(t.id) === String(teamId)) || null,
    [teams, teamId]
  );

  useEffect(() => {
    fetchMe().then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const t = await fetchScoutingTeams({ gender, competition });
        if (!cancelled) {
          setTeams(t || []);
          setTeamId("");
          setChartData(null);
          setInsights(null);
        }
      } catch (e) {
        if (!cancelled) {
          setTeams([]);
          setTeamId("");
          setChartData(null);
          setInsights(null);
          setError(e.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gender, competition]);

  async function onLoad() {
    if (!teamId) return;
    setError(null);
    setLoading(true);
    try {
      const [c, ins] = await Promise.all([
        fetchScoutingTeamCharts(Number(teamId)),
        fetchScoutingTeamInsights(Number(teamId)),
      ]);
      setChartData(c);
      setInsights(ins);
    } catch (e) {
      setError(e.message || String(e));
      setChartData(null);
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }

  function actionTitle(a) {
    if (a === "attack") return "Attack";
    if (a === "serve") return "Serve";
    if (a === "reception") return "Reception";
    if (a === "block") return "Block";
    return a;
  }

  function scoreLabel(a) {
    if (a === "reception") return "Quality score";
    return "Efficiency score";
  }

  function pct(x) {
    const v = Number(x);
    if (!Number.isFinite(v)) return "—";
    return `${Math.round(v * 100)}%`;
  }

  return (
    <div className="card">
      <h2 className="title" style={{ marginTop: 0 }}>
        Scouting
      </h2>
      <p className="muted" style={{ marginBottom: 18 }}>
        Browse teams in your category and analyze players with ML-based insights.
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

      <div style={{ display: "grid", gap: 12, alignItems: "start" }}>
        <div className="card" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, marginTop: 0 }}>
            Category
          </h3>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Competition</label>
              <select
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
              >
                {COMPETITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field" style={{ marginTop: 10 }}>
            <label>Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {formatTeamExtra(t)}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn"
              disabled={!teamId || loading}
              onClick={onLoad}
            >
              Load scouting report
            </button>
            <div className="spacer" />
            {me ? (
              <span className="muted" style={{ fontSize: 13 }}>
                Signed in as <b>{me.username}</b>
              </span>
            ) : null}
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, marginTop: 0 }}>
            Best / worst by action
          </h3>
          {!selectedTeam ? (
            <p className="muted">Select a team to view the report.</p>
          ) : !insights ? (
            <p className="muted">Load the scouting report.</p>
          ) : !insights.best_worst_by_action?.length ? (
            <p className="muted">Not enough data to rank actions yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {insights.best_worst_by_action.map((row) => (
                <div key={row.action} className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>{actionTitle(row.action)}</div>
                    <div className="spacer" />
                    <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                      {scoreLabel(row.action)}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        Best
                      </div>
                      {row.best ? (
                        <div className="row" style={{ marginTop: 6 }}>
                          <span className="tag">
                            {row.best.first_name} {row.best.last_name}
                          </span>
                          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                            {Number(row.best.score).toFixed(3)}
                          </span>
                        </div>
                      ) : (
                        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                          No data yet.
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                        Worst
                      </div>
                      {row.worst ? (
                        <div className="row" style={{ marginTop: 6 }}>
                          <span className="tag tag-warn">
                            {row.worst.first_name} {row.worst.last_name}
                          </span>
                          <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                            {Number(row.worst.score).toFixed(3)}
                          </span>
                        </div>
                      ) : (
                        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                          No data yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, marginTop: 0 }}>
            Model-based insights (volume-aware)
          </h3>
          {!selectedTeam ? (
            <p className="muted">Select a team to view the report.</p>
          ) : !insights ? (
            <p className="muted">Load the scouting report.</p>
          ) : !insights.model_insights?.length ? (
            <p className="muted">Not enough data to generate model-based insights.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {insights.model_insights.map((m) => (
                <div key={m.action} className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>{actionTitle(m.action)}</div>
                    <div className="spacer" />
                    <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                      Baseline {pct(m.category_baseline_rate)} · Prior {m.prior_strength}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                    <div className="grid-2">
                      <div>
                        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                          Best (adjusted)
                        </div>
                        {m.best_adjusted ? (
                          <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                            <div className="row">
                              <span className="tag">
                                {m.best_adjusted.first_name} {m.best_adjusted.last_name}
                              </span>
                              <span className="spacer" />
                              <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                                {pct(m.best_adjusted.adjusted_rate)}
                              </span>
                            </div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              Raw {pct(m.best_adjusted.raw_rate)} · Attempts {m.best_adjusted.attempts}
                            </div>
                          </div>
                        ) : (
                          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                            No data yet.
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                          Best (high-volume)
                        </div>
                        {m.best_high_volume ? (
                          <div style={{ marginTop: 6, display: "grid", gap: 4 }}>
                            <div className="row">
                              <span className="tag">
                                {m.best_high_volume.first_name} {m.best_high_volume.last_name}
                              </span>
                              <span className="spacer" />
                              <span className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                                {pct(m.best_high_volume.adjusted_rate)}
                              </span>
                            </div>
                            <div className="muted" style={{ fontSize: 12 }}>
                              Raw {pct(m.best_high_volume.raw_rate)} · Attempts {m.best_high_volume.attempts}
                            </div>
                          </div>
                        ) : (
                          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
                            Needs ≥ {m.min_attempts_high_volume} attempts.
                          </div>
                        )}
                      </div>
                    </div>

                    {m.best_raw_rate ? (
                      <div>
                        <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>
                          Best (raw rate)
                        </div>
                        <div style={{ marginTop: 6 }} className="muted">
                          {m.best_raw_rate.first_name} {m.best_raw_rate.last_name} · Raw{" "}
                          <b>{pct(m.best_raw_rate.raw_rate)}</b> · Attempts{" "}
                          <b>{m.best_raw_rate.attempts}</b>
                        </div>
                      </div>
                    ) : null}

                    {m.notes?.length ? (
                      <div style={{ display: "grid", gap: 6 }}>
                        {m.notes.map((t, idx) => (
                          <div key={idx} className="muted" style={{ fontSize: 12 }}>
                            {t}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 14 }} />

      {!chartData ? (
        <p className="muted">Load a team to view per-player charts.</p>
      ) : (
        <div style={{ marginTop: 6 }}>
          <h3 className="title" style={{ fontSize: 16 }}>
            Player charts
          </h3>
          <p className="muted" style={{ marginTop: -8, marginBottom: 12 }}>
            Team: <b>{selectedTeam?.name}</b>
          </p>
          <div className="chart-grid">
            {chartData.players.map((p) => (
              <PlayerStatChartsCard key={p.player_id} player={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

