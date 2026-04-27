import React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthenticatedLayout from "./components/AuthenticatedLayout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import PlayersPage from "./components/PlayersPage.jsx";
import SessionsPage from "./components/SessionsPage.jsx";
import StatsPage from "./components/StatsPage.jsx";
import TeamsPage from "./components/TeamsPage.jsx";
import MatchStatsPage from "./components/MatchStatsPage.jsx";
import ScoutingPage from "./components/ScoutingPage.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/" element={<AuthenticatedLayout />}>
          <Route index element={<Navigate to="teams" replace />} />
          <Route path="teams" element={<TeamsPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="match-stats" element={<MatchStatsPage />} />
          <Route path="scouting" element={<ScoutingPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
