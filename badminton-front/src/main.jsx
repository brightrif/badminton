// src/main.jsx

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// ── Public screens ─────────────────────────────────────────────────────────────
import App from "./App";
import UmpirePinEntry from "./pages/UmpirePinEntry";
import UmpirePanel from "./pages/UmpirePanel";
import CourtScreen from "./pages/CourtScreen"; // ← NEW

// ── Director portal ────────────────────────────────────────────────────────────
import { AuthProvider } from "./context/AuthContext";
import DirectorLayout from "./pages/director/DirectorLayout";
import DirectorLogin from "./pages/director/Login";
import DirectorDashboard from "./pages/director/Dashboard";
import DirectorTournaments from "./pages/director/Tournaments";
import DirectorMatches from "./pages/director/Matches";
import DirectorPlayers from "./pages/director/Players";
import DirectorSponsors from "./pages/director/Sponsors";
import DirectorVenues from "./pages/director/Venues";

// ── Bracket system ─────────────────────────────────────────────────────────────
import DirectorEvents from "./pages/director/Events";
import EventBracket from "./pages/director/EventBracket";

import UmpireLogin from "./pages/UmpireLogin";
import UmpireDashboard from "./pages/UmpireDashboard";
import ProtectedUmpire from "./components/ProtectedUmpire";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public screens ──────────────────────────────────────────── */}
          <Route path="/" element={<App />} />
          <Route path="/umpire" element={<UmpirePinEntry />} />
          <Route path="/umpire/:matchId/score" element={<UmpirePanel />} />

          {/* Court-based scoreboard — one permanent URL per court         */}
          {/* e.g.  /screen/court/khalifa-sc-court-1                      */}
          <Route path="/screen/court/:slug" element={<CourtScreen />} />

          {/* ── Director portal ─────────────────────────────────────────── */}
          <Route path="/director/login" element={<DirectorLogin />} />
          <Route path="/director" element={<DirectorLayout />}>
            <Route index element={<DirectorDashboard />} />
            <Route path="dashboard" element={<DirectorDashboard />} />
            <Route path="tournaments" element={<DirectorTournaments />} />
            <Route path="matches" element={<DirectorMatches />} />
            <Route path="players" element={<DirectorPlayers />} />
            <Route path="sponsors" element={<DirectorSponsors />} />
            <Route path="venues" element={<DirectorVenues />} />
            <Route path="events" element={<DirectorEvents />} />
            <Route path="events/:id/bracket" element={<EventBracket />} />
          </Route>

          {/* ── Umpire ──────────────────────────────────────────────────── */}
          <Route path="/umpire/login" element={<UmpireLogin />} />
          <Route
            path="/umpire/dashboard"
            element={
              <ProtectedUmpire>
                <UmpireDashboard />
              </ProtectedUmpire>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
);
