import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm.jsx";
import { getToken } from "../api/client.js";

export default function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    if (getToken()) {
      navigate("/teams", { replace: true });
    }
  }, [navigate]);

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
            Sign in to manage teams, players, sessions and statistics.
          </p>
        </div>
      </div>
      <LoginForm onLoggedIn={() => navigate("/teams", { replace: true })} />
    </div>
  );
}
