import React, { useEffect, useMemo, useState } from "react";
import { createTeam, deleteTeam, fetchMe, fetchTeams } from "../api/client.js";
import { canManageTeam } from "../teamAccess.js";
import { COMPETITION_OPTIONS, GENDER_OPTIONS } from "../teamLabels.js";

export default function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [step, setStep] = useState(1);
  const [gender, setGender] = useState("");
  const [competition, setCompetition] = useState("");
  const [name, setName] = useState("");

  const canContinueStep1 = gender !== "";
  const canSubmit =
    name.trim().length > 0 && gender !== "" && competition !== "";

  async function reload() {
    setError(null);
    setLoading(true);
    try {
      const [teamsData, user] = await Promise.all([fetchTeams(), fetchMe()]);
      setTeams(teamsData);
      setMe(user);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function resetForm() {
    setStep(1);
    setGender("");
    setCompetition("");
    setName("");
  }

  async function onCreate(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await createTeam({
        name: name.trim(),
        gender,
        competition,
      });
      resetForm();
      await reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteTeam(team) {
    if (!me || !canManageTeam(team, me)) return;
    const ok = window.confirm(
      `Delete team "${team.name}"? Players, sessions, and stats for this team will be removed.`
    );
    if (!ok) return;
    setError(null);
    setDeletingId(team.id);
    try {
      await deleteTeam(team.id);
      await reload();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setDeletingId(null);
    }
  }

  const stepTitle = useMemo(() => {
    if (step === 1) return "Step 1: team gender";
    return "Step 2: competition and name";
  }, [step]);

  return (
    <div className="card">
      <h2 className="title" style={{ marginTop: 0 }}>
        Teams
      </h2>

      <form onSubmit={onCreate} style={{ marginBottom: 20 }}>
        <p className="muted" style={{ marginBottom: 16 }}>{stepTitle}</p>

        {step === 1 ? (
          <>
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Women&apos;s or men&apos;s team?</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
              >
                <option value="">Select...</option>
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                type="button"
                className="btn"
                disabled={!canContinueStep1 || loading}
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
              Gender:{" "}
              <strong>
                {GENDER_OPTIONS.find((o) => o.value === gender)?.label ?? gender}
              </strong>
              {" · "}
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: 14, padding: "4px 8px" }}
                onClick={() => {
                  setStep(1);
                  setCompetition("");
                }}
              >
                Change gender
              </button>
            </p>
            <div className="field" style={{ maxWidth: 360 }}>
              <label>Competition</label>
              <select
                value={competition}
                onChange={(e) => setCompetition(e.target.value)}
                required
              >
                <option value="">Select...</option>
                {COMPETITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ maxWidth: 360, marginTop: 12 }}>
              <label>Team name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Northside VC A"
              />
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn" disabled={!canSubmit || loading} type="submit">
                {loading ? "Creating..." : "Create team"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={loading}
                onClick={() => setStep(1)}
              >
                Back
              </button>
            </div>
          </>
        )}
      </form>

      {loading && teams.length === 0 ? (
        <div className="muted" style={{ marginBottom: 12 }}>
          Loading teams...
        </div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}

      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Gender</th>
            <th>Competition</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.name}</td>
              <td>
                {t.gender
                  ? GENDER_OPTIONS.find((o) => o.value === t.gender)?.label ?? t.gender
                  : t.category || "—"}
              </td>
              <td>
                {t.competition
                  ? COMPETITION_OPTIONS.find((o) => o.value === t.competition)
                      ?.label ?? t.competition
                  : "—"}
              </td>
              <td style={{ textAlign: "right" }}>
                {me && canManageTeam(t, me) ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: "6px 12px", fontSize: 13 }}
                    disabled={loading || deletingId === t.id}
                    onClick={() => onDeleteTeam(t)}
                  >
                    {deletingId === t.id ? "Deleting…" : "Delete"}
                  </button>
                ) : (
                  <span className="muted" style={{ fontSize: 13 }}>
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
          {teams.length === 0 && !loading ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", opacity: 0.7 }}>
                No teams yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
