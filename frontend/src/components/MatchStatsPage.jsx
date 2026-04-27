import React, { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import {
  addMatchEvent,
  fetchMatchEvents,
  fetchMatchLineups,
  fetchMe,
  fetchSessions,
  fetchTeams,
  saveMatchLineup,
  undoLastMatchEvent,
} from "../api/client.js";
import { canManageTeam } from "../teamAccess.js";
import { formatTeamExtra } from "../teamLabels.js";

const EVENT_OPTIONS = [
  { value: "attack_point", label: "Attack point" },
  { value: "attack_out", label: "Attack out" },
  { value: "block_point", label: "Block point" },
  { value: "block_out", label: "Block out" },
  { value: "serve_ace", label: "Serve ace" },
  { value: "serve_fault", label: "Serve fault" },
  { value: "opponent_error", label: "Opponent error" },
];

function computeSetScore(events, setNumber) {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (Number(e.set_number) !== Number(setNumber)) continue;
    if (e.scoring_side === "home") home += 1;
    if (e.scoring_side === "away") away += 1;
  }
  return { home, away };
}

function isSetFinished(setNumber, score) {
  const target = Number(setNumber) === 5 ? 15 : 25;
  const max = Math.max(score.home, score.away);
  const diff = Math.abs(score.home - score.away);
  return max >= target && diff >= 2;
}

function setWinner(score) {
  if (score.home === score.away) return null;
  return score.home > score.away ? "home" : "away";
}

function computeMatchState(events) {
  const sets = [];
  let homeSets = 0;
  let awaySets = 0;
  for (let s = 1; s <= 5; s += 1) {
    const score = computeSetScore(events, s);
    const finished = isSetFinished(s, score);
    const winner = finished ? setWinner(score) : null;
    if (winner === "home") homeSets += 1;
    if (winner === "away") awaySets += 1;
    sets.push({ setNumber: s, score, finished, winner });
  }
  const matchFinished = homeSets === 3 || awaySets === 3;
  let currentSet = 1;
  for (const s of sets) {
    if (!s.finished) {
      currentSet = s.setNumber;
      break;
    }
    currentSet = Math.min(5, s.setNumber + 1);
  }
  return { sets, homeSets, awaySets, matchFinished, currentSet };
}

function countByEvent(events, side) {
  const out = {};
  for (const e of events) {
    if (side && e.scoring_side !== side) continue;
    out[e.event_type] = (out[e.event_type] || 0) + 1;
  }
  return out;
}

function downloadPdf({ team, matchSession, lineups, events }) {
  const doc = new jsPDF();
  const x = 14;
  let y = 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Match statistics", x, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const opponentLabel =
    matchSession?.opponent_team_id != null
      ? `Opponent team #${matchSession.opponent_team_id}`
      : "Opponent";
  doc.text(`${team?.name || "Team"} vs ${opponentLabel}`, x, y);
  y += 6;
  doc.text(`Date: ${matchSession?.date || "—"}`, x, y);
  y += 9;

  const matchState = computeMatchState(events);
  doc.setFont("helvetica", "bold");
  doc.text(`Set score: ${matchState.homeSets} - ${matchState.awaySets}`, x, y);
  y += 10;

  const set1Home =
    lineups.find((l) => l.side === "home" && Number(l.set_number) === 1) || null;
  const set1Away =
    lineups.find((l) => l.side === "away" && Number(l.set_number) === 1) || null;
  const homeName = set1Home?.team_name?.trim()
    ? set1Home.team_name.trim()
    : team?.name || "Home";
  const awayName = set1Away?.team_name?.trim() ? set1Away.team_name.trim() : "Away";

  doc.setFont("helvetica", "bold");
  doc.text("Set summary", x, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const s of matchState.sets) {
    const w = s.winner ? s.winner.toUpperCase() : "—";
    doc.text(
      `Set ${s.setNumber}: ${s.score.home}-${s.score.away}  Winner: ${w}`,
      x,
      y
    );
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }
  y += 6;
  const set1HomeRot = [
    set1Home?.p1,
    set1Home?.p2,
    set1Home?.p3,
    set1Home?.p4,
    set1Home?.p5,
    set1Home?.p6,
  ]
    .filter((n) => n != null)
    .join(", ");
  const set1AwayRot = [
    set1Away?.p1,
    set1Away?.p2,
    set1Away?.p3,
    set1Away?.p4,
    set1Away?.p5,
    set1Away?.p6,
  ]
    .filter((n) => n != null)
    .join(", ");

  doc.setFont("helvetica", "bold");
  doc.text("Starting rotation (set 1)", x, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.text(`${homeName}: ${set1HomeRot || "—"}`, x, y);
  y += 6;
  doc.text(`${awayName}: ${set1AwayRot || "—"}`, x, y);
  y += 10;

  const allTypes = EVENT_OPTIONS.map((o) => o.value);
  const homeCounts = countByEvent(events, "home");
  const awayCounts = countByEvent(events, "away");

  doc.setFont("helvetica", "bold");
  doc.text("Summary (home)", x, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const t of allTypes) {
    const label = EVENT_OPTIONS.find((o) => o.value === t)?.label || t;
    doc.text(`${label}: ${homeCounts[t] || 0}`, x, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Summary (away)", x, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  for (const t of allTypes) {
    const label = EVENT_OPTIONS.find((o) => o.value === t)?.label || t;
    doc.text(`${label}: ${awayCounts[t] || 0}`, x, y);
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("Point log", x, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  let curSet = null;
  let runHome = 0;
  let runAway = 0;
  for (const e of events) {
    const sn = Number(e.set_number);
    if (curSet == null || sn !== curSet) {
      curSet = sn;
      runHome = 0;
      runAway = 0;
    }
    if (e.scoring_side === "home") runHome += 1;
    if (e.scoring_side === "away") runAway += 1;
    const label = EVENT_OPTIONS.find((o) => o.value === e.event_type)?.label || e.event_type;
    const pn = e.player_number != null ? ` #${e.player_number}` : "";
  doc.text(
    `S${e.set_number} · ${e.rally_index} (${runHome}-${runAway}). ${e.scoring_side.toUpperCase()} · ${label}${pn}`,
    x,
    y
  );
    y += 6;
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
  }

  doc.save(`match-stats-${matchSession?.id || "match"}.pdf`);
}

function RotationEditor({ title, teamName, setTeamName, rotation, setRotation, disabled }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ alignItems: "baseline" }}>
        <h3 className="title" style={{ fontSize: 16, margin: 0 }}>
          {title}
        </h3>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Team label (optional)</label>
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder={title === "Home" ? "Home" : "Away"}
          disabled={disabled}
        />
      </div>
      <div className="grid-2">
        {["p1", "p2", "p3", "p4", "p5", "p6"].map((k, idx) => (
          <div className="field" key={k} style={{ marginBottom: 0 }}>
            <label>Position {idx + 1}</label>
            <input
              type="number"
              min={0}
              value={rotation[k]}
              onChange={(e) => setRotation((r) => ({ ...r, [k]: e.target.value }))}
              placeholder="Jersey #"
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MatchStatsPage() {
  const [me, setMe] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState("");
  const [matchSessions, setMatchSessions] = useState([]);
  const [matchSessionId, setMatchSessionId] = useState("");

  const [lineups, setLineups] = useState([]);
  const [events, setEvents] = useState([]);

  const [homeName, setHomeName] = useState("");
  const [awayName, setAwayName] = useState("");
  const [homeRot, setHomeRot] = useState({
    p1: "",
    p2: "",
    p3: "",
    p4: "",
    p5: "",
    p6: "",
  });
  const [awayRot, setAwayRot] = useState({
    p1: "",
    p2: "",
    p3: "",
    p4: "",
    p5: "",
    p6: "",
  });

  const [scoringSide, setScoringSide] = useState("home");
  const [eventType, setEventType] = useState("attack_point");
  const [playerNumber, setPlayerNumber] = useState("");
  const [setNumber, setSetNumber] = useState(1);

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const managedTeams = useMemo(() => {
    if (!me) return [];
    return teams.filter((t) => canManageTeam(t, me));
  }, [teams, me]);

  const selectedTeam = useMemo(
    () => teams.find((t) => String(t.id) === String(teamId)) || null,
    [teams, teamId]
  );

  const selectedMatch = useMemo(
    () => matchSessions.find((s) => String(s.id) === String(matchSessionId)) || null,
    [matchSessions, matchSessionId]
  );

  const matchState = useMemo(() => computeMatchState(events), [events]);
  const currentSetScore = useMemo(
    () => computeSetScore(events, setNumber),
    [events, setNumber]
  );
  const currentSetFinished = useMemo(
    () => isSetFinished(setNumber, currentSetScore),
    [setNumber, currentSetScore]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [u, t] = await Promise.all([fetchMe(), fetchTeams()]);
        if (!cancelled) {
          setMe(u);
          setTeams(t);
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!teamId) {
      setMatchSessions([]);
      setMatchSessionId("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchSessions({ team_id: Number(teamId) });
        const matches = (s || []).filter((x) => Boolean(x.is_match));
        if (!cancelled) {
          setMatchSessions(matches);
          setMatchSessionId("");
        }
      } catch (e) {
        if (!cancelled) {
          setMatchSessions([]);
          setMatchSessionId("");
          setError(e.message || String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    if (!matchSessionId) {
      setLineups([]);
      setEvents([]);
      setSetNumber(1);
      return;
    }
    let cancelled = false;
    (async () => {
      setError(null);
      setLoading(true);
      try {
        const [l, ev] = await Promise.all([
          fetchMatchLineups(Number(matchSessionId)),
          fetchMatchEvents(Number(matchSessionId)),
        ]);
        if (cancelled) return;
        setLineups(l || []);
        setEvents(ev || []);
        const ms = computeMatchState(ev || []);
        setSetNumber(ms.currentSet);
        const home = (l || []).find((x) => x.side === "home") || null;
        const away = (l || []).find((x) => x.side === "away") || null;
        setHomeName(home?.team_name || "");
        setAwayName(away?.team_name || "");
        setHomeRot({
          p1: home?.p1 != null ? String(home.p1) : "",
          p2: home?.p2 != null ? String(home.p2) : "",
          p3: home?.p3 != null ? String(home.p3) : "",
          p4: home?.p4 != null ? String(home.p4) : "",
          p5: home?.p5 != null ? String(home.p5) : "",
          p6: home?.p6 != null ? String(home.p6) : "",
        });
        setAwayRot({
          p1: away?.p1 != null ? String(away.p1) : "",
          p2: away?.p2 != null ? String(away.p2) : "",
          p3: away?.p3 != null ? String(away.p3) : "",
          p4: away?.p4 != null ? String(away.p4) : "",
          p5: away?.p5 != null ? String(away.p5) : "",
          p6: away?.p6 != null ? String(away.p6) : "",
        });
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchSessionId]);

  async function onSaveLineups() {
    if (!matchSessionId) return;
    setError(null);
    setLoading(true);
    try {
      await Promise.all([
        saveMatchLineup(matchSessionId, "home", {
          set_number: setNumber,
          team_name: homeName,
          ...homeRot,
        }),
        saveMatchLineup(matchSessionId, "away", {
          set_number: setNumber,
          team_name: awayName,
          ...awayRot,
        }),
      ]);
      const l = await fetchMatchLineups(Number(matchSessionId));
      setLineups(l || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onAddPoint() {
    if (!matchSessionId) return;
    if (matchState.matchFinished) return;
    if (currentSetFinished) return;
    setError(null);
    setLoading(true);
    try {
      await addMatchEvent(matchSessionId, {
        set_number: setNumber,
        rally_index: Number(currentSetScore.home + currentSetScore.away) + 1,
        scoring_side: scoringSide,
        event_type: eventType,
        player_number: playerNumber,
      });
      const ev = await fetchMatchEvents(Number(matchSessionId));
      setEvents(ev || []);
      const ms = computeMatchState(ev || []);
      setSetNumber(ms.currentSet);
      setPlayerNumber("");
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onUndo() {
    if (!matchSessionId) return;
    setError(null);
    setLoading(true);
    try {
      await undoLastMatchEvent(Number(matchSessionId));
      const ev = await fetchMatchEvents(Number(matchSessionId));
      setEvents(ev || []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function onExportPdf() {
    if (!selectedTeam || !selectedMatch) return;
    downloadPdf({
      team: selectedTeam,
      matchSession: selectedMatch,
      lineups,
      events,
    });
  }

  function onNextSet() {
    if (!currentSetFinished) return;
    if (matchState.matchFinished) return;
    setSetNumber((s) => Math.min(5, Number(s) + 1));
  }

  return (
    <div className="card">
      <h2 className="title" style={{ marginTop: 0 }}>
        Match stats
      </h2>
      <p className="muted" style={{ marginBottom: 18 }}>
        Enter starting rotations and track the match point-by-point.
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

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="card" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, marginTop: 0 }}>
            Match
          </h3>
          <div className="field">
            <label>Team</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              <option value="">Select team</option>
              {managedTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {formatTeamExtra(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Match session</label>
            <select
              value={matchSessionId}
              onChange={(e) => setMatchSessionId(e.target.value)}
              disabled={!teamId}
            >
              <option value="">Select match</option>
              {matchSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date}
                  {s.type ? ` · ${s.type}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <div className="pill" title="Current score">
              <span style={{ fontWeight: 900 }}>Set</span>
              <span className="muted">·</span>
              <span style={{ fontWeight: 900 }}>{matchState.homeSets}</span>
              <span className="muted">-</span>
              <span style={{ fontWeight: 900 }}>{matchState.awaySets}</span>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="btn"
              disabled={!selectedMatch || loading}
              onClick={onExportPdf}
            >
              Download PDF
            </button>
          </div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            <div className="pill" title="Current set points">
              <span style={{ fontWeight: 900 }}>Set {setNumber}</span>
              <span className="muted">·</span>
              <span style={{ fontWeight: 900 }}>{currentSetScore.home}</span>
              <span className="muted">-</span>
              <span style={{ fontWeight: 900 }}>{currentSetScore.away}</span>
            </div>
            <div className="spacer" />
            <button
              type="button"
              className="btn-ghost"
              disabled={!selectedMatch || loading || !currentSetFinished}
              onClick={onNextSet}
            >
              Next set
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <h3 className="title" style={{ fontSize: 16, marginTop: 0 }}>
            Point entry
          </h3>
          <div className="grid-2">
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Set</label>
              <select
                value={String(setNumber)}
                onChange={(e) => setSetNumber(Number(e.target.value))}
                disabled={!selectedMatch || loading}
              >
                {[1, 2, 3, 4, 5].map((s) => (
                  <option key={s} value={String(s)}>
                    Set {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Point for</label>
              <select
                value={scoringSide}
                onChange={(e) => setScoringSide(e.target.value)}
                disabled={!selectedMatch}
              >
                <option value="home">Home</option>
                <option value="away">Away</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Event</label>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                disabled={!selectedMatch}
              >
                {EVENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Player number (optional)</label>
              <input
                type="number"
                min={0}
                value={playerNumber}
                onChange={(e) => setPlayerNumber(e.target.value)}
                placeholder="Jersey #"
                disabled={!selectedMatch}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Next point</label>
              <input value={String(currentSetScore.home + currentSetScore.away + 1)} disabled />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn"
              onClick={onAddPoint}
              disabled={!selectedMatch || loading || matchState.matchFinished || currentSetFinished}
            >
              Add point
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={onUndo}
              disabled={!selectedMatch || loading || !events.length}
            >
              Undo last
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <RotationEditor
          title="Home"
          teamName={homeName}
          setTeamName={setHomeName}
          rotation={homeRot}
          setRotation={setHomeRot}
          disabled={!selectedMatch || loading}
        />
        <RotationEditor
          title="Away"
          teamName={awayName}
          setTeamName={setAwayName}
          rotation={awayRot}
          setRotation={setAwayRot}
          disabled={!selectedMatch || loading}
        />
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn"
          onClick={onSaveLineups}
          disabled={!selectedMatch || loading}
        >
          Save rotations
        </button>
      </div>

      <div style={{ height: 18 }} />

      <div className="card" style={{ padding: 14 }}>
        <h3 className="title" style={{ fontSize: 16, marginTop: 0 }}>
          Point log
        </h3>
        {!events.length ? (
          <p className="muted">No points yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Set</th>
                  <th>Side</th>
                  <th>Event</th>
                  <th>Player</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const label =
                    EVENT_OPTIONS.find((o) => o.value === e.event_type)?.label ||
                    e.event_type;
                  return (
                    <tr key={e.id}>
                      <td>{e.rally_index}</td>
                      <td>{e.set_number}</td>
                      <td>{e.scoring_side}</td>
                      <td>{label}</td>
                      <td>{e.player_number != null ? `#${e.player_number}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

