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

const POINT_EVENT_TYPES = new Set(EVENT_OPTIONS.map((o) => o.value));

function lineupPlayers(lineup) {
  if (!lineup) return [];
  const xs = [lineup.p1, lineup.p2, lineup.p3, lineup.p4, lineup.p5, lineup.p6]
    .map((n) => (n == null ? null : Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return Array.from(new Set(xs)).sort((a, b) => a - b);
}

function computeSetScore(events, setNumber) {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (Number(e.set_number) !== Number(setNumber)) continue;
    if (!POINT_EVENT_TYPES.has(e.event_type)) continue;
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
    if (!POINT_EVENT_TYPES.has(e.event_type)) continue;
    out[e.event_type] = (out[e.event_type] || 0) + 1;
  }
  return out;
}

function applySubstitutionsToRotation(players, events, { setNumber, side }) {
  const cur = [...players];
  const byTime = (events || [])
    .filter(
      (e) =>
        Number(e.set_number) === Number(setNumber) &&
        e.scoring_side === side &&
        e.event_type === "substitution"
    )
    .slice()
    .sort((a, b) => {
      const ra = Number(a.rally_index ?? 0);
      const rb = Number(b.rally_index ?? 0);
      if (ra !== rb) return ra - rb;
      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

  for (const e of byTime) {
    const outN =
      e.player_out_number == null || e.player_out_number === ""
        ? null
        : Number(e.player_out_number);
    const inN =
      e.player_in_number == null || e.player_in_number === ""
        ? null
        : Number(e.player_in_number);
    if (!Number.isFinite(outN) || !Number.isFinite(inN)) continue;

    const idx = cur.indexOf(outN);
    if (idx >= 0) {
      cur.splice(idx, 1, inN);
    } else if (!cur.includes(inN)) {
      cur.push(inN);
    }
  }

  return Array.from(new Set(cur)).sort((a, b) => a - b);
}

function downloadPdf({ team, matchSession, lineups, events }) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentW = pageW - marginX * 2;
  const bottomY = pageH - 14;
  let y = 14;

  const COLORS = {
    ink: [24, 24, 27],
    muted: [82, 82, 91],
    line: [228, 228, 231],
    headerBg: [245, 245, 246],
    zebra: [251, 251, 252],
    home: [30, 64, 175],
    away: [124, 45, 18],
  };

  function ensureSpace(neededMm) {
    if (y + neededMm <= bottomY) return;
    doc.addPage();
    y = 14;
  }

  function hLine() {
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, marginX + contentW, y);
  }

  function sectionTitle(text) {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...COLORS.ink);
    doc.text(text, marginX, y);
    y += 6;
    hLine();
    y += 7;
  }

  function writeWrapped(text, { fontSize = 11, color = COLORS.ink, lineHeight = 5.6 } = {}) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(String(text), contentW);
    ensureSpace(lines.length * lineHeight + 2);
    doc.text(lines, marginX, y);
    y += lines.length * lineHeight;
  }

  // ---- Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.ink);
  doc.text("Match statistics", marginX, y);
  y += 8.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.muted);
  const opponentLabel =
    matchSession?.opponent_team_id != null
      ? `Opponent team #${matchSession.opponent_team_id}`
      : "Opponent";
  doc.text(`${team?.name || "Team"} vs ${opponentLabel}`, marginX, y);
  y += 5.6;
  doc.text(`Date: ${matchSession?.date || "—"}`, marginX, y);
  y += 7.5;

  const matchState = computeMatchState(events);

  const set1Home =
    lineups.find((l) => l.side === "home" && Number(l.set_number) === 1) || null;
  const set1Away =
    lineups.find((l) => l.side === "away" && Number(l.set_number) === 1) || null;
  const homeName = set1Home?.team_name?.trim()
    ? set1Home.team_name.trim()
    : team?.name || "Home";
  const awayName = set1Away?.team_name?.trim() ? set1Away.team_name.trim() : "Away";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.text(
    `Match score (sets): ${homeName} ${matchState.homeSets} - ${matchState.awaySets} ${awayName}`,
    marginX,
    y
  );
  y += 8;

  // ---- Set summary
  sectionTitle("Set summary");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  for (const s of matchState.sets) {
    const isAnyPoint = s.score.home > 0 || s.score.away > 0;
    if (!isAnyPoint && !s.finished) continue;
    ensureSpace(7);
    const w = s.winner === "home" ? homeName : s.winner === "away" ? awayName : "—";
    doc.text(
      `Set ${s.setNumber}: ${homeName} ${s.score.home} - ${s.score.away} ${awayName}   Winner: ${w}`,
      marginX,
      y
    );
    y += 6;
  }
  y += 2;

  // ---- Starting rotation
  const set1HomeRot = [
    set1Home?.p1,
    set1Home?.p2,
    set1Home?.p3,
    set1Home?.p4,
    set1Home?.p5,
    set1Home?.p6,
  ]
    .filter((n) => n != null && String(n).trim() !== "")
    .join(", ");
  const set1AwayRot = [
    set1Away?.p1,
    set1Away?.p2,
    set1Away?.p3,
    set1Away?.p4,
    set1Away?.p5,
    set1Away?.p6,
  ]
    .filter((n) => n != null && String(n).trim() !== "")
    .join(", ");

  sectionTitle("Starting rotation (set 1)");
  writeWrapped(`${homeName}: ${set1HomeRot || "—"}`, { fontSize: 11, color: COLORS.ink });
  y += 1.2;
  writeWrapped(`${awayName}: ${set1AwayRot || "—"}`, { fontSize: 11, color: COLORS.ink });
  y += 3;

  // ---- Summary counts
  const allTypes = EVENT_OPTIONS.map((o) => o.value);
  const homeCounts = countByEvent(events, "home");
  const awayCounts = countByEvent(events, "away");

  sectionTitle("Summary (counts)");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.ink);
  doc.text(homeName, marginX, y);
  doc.text(awayName, marginX + contentW / 2, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.ink);
  for (const t of allTypes) {
    ensureSpace(7);
    const label = EVENT_OPTIONS.find((o) => o.value === t)?.label || t;
    doc.text(label, marginX, y);
    doc.text(String(homeCounts[t] || 0), marginX + contentW / 2 - 2, y, { align: "right" });
    doc.text(String(awayCounts[t] || 0), marginX + contentW - 2, y, { align: "right" });
    y += 6;
  }
  y += 2;

  // ---- Point log by set (styled table)
  sectionTitle("Point log (by set)");

  const tableX = marginX;
  const col = {
    rally: 14,
    score: 22,
    side: 22,
    action: contentW - (14 + 22 + 22 + 24),
    player: 24,
  };
  const tableW = col.rally + col.score + col.side + col.action + col.player;
  const rowH = 6.2;

  function drawTableHeader() {
    ensureSpace(rowH + 2);
    doc.setFillColor(...COLORS.headerBg);
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    doc.rect(tableX, y - 4.5, tableW, rowH + 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.muted);
    let cx = tableX + 2;
    doc.text("Rally", cx, y);
    cx += col.rally;
    doc.text("Score", cx, y);
    cx += col.score;
    doc.text("Side", cx, y);
    cx += col.side;
    doc.text("Action", cx, y);
    cx += col.action;
    doc.text("Player", cx, y);
    y += rowH;
  }

  const bySet = new Map();
  for (const e of events || []) {
    const sn = Number(e.set_number || 0);
    if (!sn) continue;
    if (!bySet.has(sn)) bySet.set(sn, []);
    bySet.get(sn).push(e);
  }

  const setNumbers = Array.from(bySet.keys()).sort((a, b) => a - b);
  if (setNumbers.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.muted);
    doc.text("No points recorded yet.", marginX, y);
    y += 6;
  } else {
    for (const sn of setNumbers) {
      const setEvents = bySet.get(sn) || [];
      const setScore = computeSetScore(events, sn);
      const winnerSide = isSetFinished(sn, setScore) ? setWinner(setScore) : null;
      const winnerName =
        winnerSide === "home" ? homeName : winnerSide === "away" ? awayName : "—";

      ensureSpace(18);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.ink);
      doc.text(
        `Set ${sn} — ${homeName} ${setScore.home} - ${setScore.away} ${awayName}`,
        marginX,
        y
      );
      y += 5.8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...COLORS.muted);
      doc.text(`Winner: ${winnerName}`, marginX, y);
      y += 7;

      drawTableHeader();

      let runHome = 0;
      let runAway = 0;
      let row = 0;

      for (const e of setEvents) {
        ensureSpace(rowH + 2);
        if (row % 2 === 1) {
          doc.setFillColor(...COLORS.zebra);
          doc.rect(tableX, y - 4.3, tableW, rowH, "F");
        }

        const isPoint = POINT_EVENT_TYPES.has(e.event_type);
        if (isPoint && e.scoring_side === "home") runHome += 1;
        if (isPoint && e.scoring_side === "away") runAway += 1;

        const actionLabel =
          e.event_type === "substitution"
            ? "Sub"
            : EVENT_OPTIONS.find((o) => o.value === e.event_type)?.label || e.event_type;
        const playerLabel =
          e.event_type === "substitution"
            ? `#${e.player_out_number ?? "—"}→#${e.player_in_number ?? "—"}`
            : e.player_number != null
              ? `#${e.player_number}`
              : "—";
        const scoreLabel = `${runHome}-${runAway}`;

        let cx = tableX + 2;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(...COLORS.ink);

        doc.text(String(e.rally_index ?? row + 1), cx, y);
        cx += col.rally;
        doc.text(scoreLabel, cx, y);
        cx += col.score;

        const sideText = e.scoring_side === "home" ? "HOME" : "AWAY";
        const sideColor = e.scoring_side === "home" ? COLORS.home : COLORS.away;
        doc.setTextColor(...sideColor);
        doc.setFont("helvetica", "bold");
        doc.text(sideText, cx, y);
        cx += col.side;

        doc.setTextColor(...COLORS.ink);
        doc.setFont("helvetica", "normal");
        doc.text(String(actionLabel), cx, y, { maxWidth: col.action - 4 });
        cx += col.action;
        doc.setTextColor(...COLORS.muted);
        doc.text(String(playerLabel), cx, y, { maxWidth: col.player - 4 });

        y += rowH;
        row += 1;
      }

      y += 4;
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
  const [subPlayerOut, setSubPlayerOut] = useState("");
  const [subPlayerIn, setSubPlayerIn] = useState("");
  const [subSide, setSubSide] = useState("home");
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

  const lineupsByKey = useMemo(() => {
    const m = new Map();
    for (const l of lineups || []) {
      m.set(`${l.side}:${Number(l.set_number)}`, l);
    }
    return m;
  }, [lineups]);

  const currentHomeLineup = useMemo(
    () => lineupsByKey.get(`home:${Number(setNumber)}`) || null,
    [lineupsByKey, setNumber]
  );
  const currentAwayLineup = useMemo(
    () => lineupsByKey.get(`away:${Number(setNumber)}`) || null,
    [lineupsByKey, setNumber]
  );

  const currentSideLineup = subSide === "home" ? currentHomeLineup : currentAwayLineup;
  const playerOutOptions = useMemo(() => {
    const base = lineupPlayers(currentSideLineup);
    return applySubstitutionsToRotation(base, events, { setNumber, side: subSide });
  }, [currentSideLineup, events, setNumber, subSide]);

  const requiredLineupsReady = Boolean(
    selectedMatch &&
      lineupsByKey.get(`home:${Number(setNumber)}`) &&
      lineupsByKey.get(`away:${Number(setNumber)}`)
  );

  useEffect(() => {
    if (!selectedMatch) return;
    const home = lineupsByKey.get(`home:${Number(setNumber)}`) || null;
    const away = lineupsByKey.get(`away:${Number(setNumber)}`) || null;
    if (home) {
      setHomeName(home.team_name?.trim() ? home.team_name.trim() : homeName);
      setHomeRot({
        p1: home?.p1 != null ? String(home.p1) : "",
        p2: home?.p2 != null ? String(home.p2) : "",
        p3: home?.p3 != null ? String(home.p3) : "",
        p4: home?.p4 != null ? String(home.p4) : "",
        p5: home?.p5 != null ? String(home.p5) : "",
        p6: home?.p6 != null ? String(home.p6) : "",
      });
    } else {
      setHomeRot({ p1: "", p2: "", p3: "", p4: "", p5: "", p6: "" });
    }
    if (away) {
      setAwayName(away.team_name?.trim() ? away.team_name.trim() : awayName);
      setAwayRot({
        p1: away?.p1 != null ? String(away.p1) : "",
        p2: away?.p2 != null ? String(away.p2) : "",
        p3: away?.p3 != null ? String(away.p3) : "",
        p4: away?.p4 != null ? String(away.p4) : "",
        p5: away?.p5 != null ? String(away.p5) : "",
        p6: away?.p6 != null ? String(away.p6) : "",
      });
    } else {
      setAwayRot({ p1: "", p2: "", p3: "", p4: "", p5: "", p6: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatch, setNumber, lineupsByKey]);

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
    if (!requiredLineupsReady) {
      setError(`You must save both team rotations for set ${setNumber} before adding events.`);
      return;
    }
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

  async function onAddSubstitution() {
    if (!matchSessionId) return;
    if (matchState.matchFinished) return;
    if (!requiredLineupsReady) {
      setError(`You must save both team rotations for set ${setNumber} before adding events.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const nextIdx = Number(currentSetScore.home + currentSetScore.away) + 1;
      await addMatchEvent(matchSessionId, {
        set_number: setNumber,
        rally_index: nextIdx,
        scoring_side: subSide,
        event_type: "substitution",
        player_out_number: subPlayerOut,
        player_in_number: subPlayerIn,
      });
      const ev = await fetchMatchEvents(Number(matchSessionId));
      setEvents(ev || []);
      setSubPlayerOut("");
      setSubPlayerIn("");
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

      <div style={{ display: "grid", gap: 12, alignItems: "start" }}>
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
          {!requiredLineupsReady ? (
            <div className="alert" style={{ marginBottom: 12 }}>
              <div className="alert-icon" aria-hidden="true">
                i
              </div>
              <div>
                <p className="alert-title">Rotations required</p>
                <p className="alert-text">
                  Save both team rotations for <b>set {setNumber}</b> before recording points or
                  substitutions.
                </p>
              </div>
            </div>
          ) : null}
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
              disabled={
                !selectedMatch ||
                loading ||
                matchState.matchFinished ||
                currentSetFinished ||
                !requiredLineupsReady
              }
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

          <div style={{ height: 14 }} />
          <h4 className="title" style={{ fontSize: 14, margin: 0 }}>
            Substitution
          </h4>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Team</label>
              <select
                value={subSide}
                onChange={(e) => {
                  const v = e.target.value;
                  setSubSide(v);
                  setSubPlayerOut("");
                }}
                disabled={!selectedMatch || loading}
              >
                <option value="home">{homeName || "Home"}</option>
                <option value="away">{awayName || "Away"}</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Player out</label>
              <select
                value={subPlayerOut}
                onChange={(e) => setSubPlayerOut(e.target.value)}
                disabled={!selectedMatch || loading || !requiredLineupsReady}
              >
                <option value="">Select from rotation</option>
                {playerOutOptions.map((n) => (
                  <option key={n} value={String(n)}>
                    #{n}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Player in</label>
              <input
                type="number"
                min={0}
                value={subPlayerIn}
                onChange={(e) => setSubPlayerIn(e.target.value)}
                placeholder="Jersey #"
                disabled={!selectedMatch || loading}
              />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={onAddSubstitution}
              disabled={
                !selectedMatch ||
                loading ||
                matchState.matchFinished ||
                !requiredLineupsReady ||
                !subPlayerOut ||
                !subPlayerIn
              }
            >
              Record substitution
            </button>
            <div className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
              Saved at “Next point” index (doesn’t change the score)
            </div>
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
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const sideLabel = e.scoring_side === "home" ? homeName || "Home" : awayName || "Away";
                  const label =
                    e.event_type === "substitution"
                      ? "Substitution"
                      : EVENT_OPTIONS.find((o) => o.value === e.event_type)?.label ||
                        e.event_type;
                  const details =
                    e.event_type === "substitution"
                      ? `out #${e.player_out_number ?? "—"} → in #${e.player_in_number ?? "—"}`
                      : e.player_number != null
                        ? `#${e.player_number}`
                        : "—";
                  return (
                    <tr key={e.id}>
                      <td>{e.rally_index}</td>
                      <td>{e.set_number}</td>
                      <td style={{ fontWeight: 800 }}>{sideLabel}</td>
                      <td>{label}</td>
                      <td className="cell-wrap">{details}</td>
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

