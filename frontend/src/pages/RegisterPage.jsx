import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getToken, login, registerCoach } from "../api/client.js";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => username.trim().length > 0 && password.length > 0,
    [username, password]
  );

  useEffect(() => {
    if (getToken()) {
      navigate("/teams", { replace: true });
    }
  }, [navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerCoach(username.trim(), password);
      await login(username.trim(), password);
      navigate("/teams", { replace: true });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <div className="split" style={{ marginBottom: 14 }}>
        <div>
          <div className="row" style={{ gap: 10 }}>
            <span className="badge-dot" aria-hidden="true" />
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 0.2 }}>
              Volleyball Performance
            </h1>
          </div>
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Create a coach account to start managing your teams.
          </p>
        </div>
      </div>
      <div className="card" style={{ maxWidth: 420 }}>
        <h2 className="title">Coach registration</h2>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <button className="btn" disabled={!canSubmit || loading} type="submit">
            {loading ? "Creating account..." : "Create account and sign in"}
          </button>
        </form>
        {error ? (
          <div className="alert alert-error" style={{ marginTop: 12 }}>
            <div className="alert-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="alert-title">Registration failed</p>
              <p className="alert-text">{error}</p>
            </div>
          </div>
        ) : null}
        <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
