import React, { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearToken, fetchMe, getToken } from "../api/client.js";

export default function AuthenticatedLayout() {
  const [me, setMe] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!getToken()) return;
    fetchMe()
      .then(setMe)
      .catch(() => {
        clearToken();
        navigate("/login", { replace: true });
      });
  }, [navigate]);

  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }

  function onLogout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app">
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="badge-dot" aria-hidden="true" />
            <div>
              <p className="sidebar-title">Volleyball Performance</p>
              <p className="sidebar-subtitle">Data Management</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            <NavLink
              to="teams"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              <span>Teams</span>
              <span className="muted" style={{ fontSize: 12 }}>
                T
              </span>
            </NavLink>
            <NavLink
              to="players"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              <span>Players</span>
              <span className="muted" style={{ fontSize: 12 }}>
                P
              </span>
            </NavLink>
            <NavLink
              to="sessions"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              <span>Sessions</span>
              <span className="muted" style={{ fontSize: 12 }}>
                S
              </span>
            </NavLink>
            <NavLink
              to="stats"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              <span>Stats</span>
              <span className="muted" style={{ fontSize: 12 }}>
                Σ
              </span>
            </NavLink>
            <NavLink
              to="match-stats"
              className={({ isActive }) =>
                isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
              }
            >
              <span>Match stats</span>
              <span className="muted" style={{ fontSize: 12 }}>
                M
              </span>
            </NavLink>
            {me?.role === "coach" ? (
              <NavLink
                to="scouting"
                className={({ isActive }) =>
                  isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
                }
              >
                <span>Scouting</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Scout
                </span>
              </NavLink>
            ) : null}
          </nav>

          <div style={{ marginTop: 14 }}>
            {me ? (
              <div className="pill" title="Signed in user">
                <span style={{ fontWeight: 800 }}>{me.username}</span>
                <span className="muted">·</span>
                <span className="muted">{me.role}</span>
              </div>
            ) : null}

            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn-ghost" onClick={onLogout}>
                Logout
              </button>
            </div>
          </div>
        </aside>

        <main className="content">
          <div className="topbar">
            <div className="muted" style={{ fontSize: 13, fontWeight: 700 }}>
              Tip: Use Teams to create, then Players/Sessions/Stats.
            </div>
            <div className="topbar-right">
              {me ? (
                <span className="muted" style={{ fontSize: 13 }}>
                  Signed in as <b>{me.username}</b>
                </span>
              ) : null}
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
