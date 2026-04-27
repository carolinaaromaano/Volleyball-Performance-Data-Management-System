import React, { useState } from "react";
import { Link } from "react-router-dom";
import { login } from "../api/client.js";

export default function LoginForm({ onLoggedIn }) {
  const [username, setUsername] = useState("coach");
  const [password, setPassword] = useState("coach123");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onLoggedIn();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h2 className="title">Login</h2>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label>username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="field">
          <label>password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn" disabled={loading} type="submit">
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      {error ? (
        <div className="alert alert-error" style={{ marginTop: 12 }}>
          <div className="alert-icon" aria-hidden="true">
            !
          </div>
          <div>
            <p className="alert-title">Login failed</p>
            <p className="alert-text">{error}</p>
          </div>
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
        <Link to="/register">Create coach account</Link>
      </p>
      <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        Default seed: <code>coach</code> / <code>coach123</code>
      </p>
    </div>
  );
}

