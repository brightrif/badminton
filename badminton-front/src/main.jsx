import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ── Existing screens ──────────────────────────────────────────────────────────
import App            from "./App";                        // big screen /
import UmpirePinEntry from "./pages/UmpirePinEntry";       // /umpire
import UmpirePanel    from "./pages/UmpirePanel";          // /umpire/:matchId/score

// ── Director portal ───────────────────────────────────────────────────────────
import { AuthProvider } from "./context/AuthContext";
import DirectorLayout   from "./pages/director/DirectorLayout";
import DirectorLogin    from "./pages/director/Login";
import Dashboard        from "./pages/director/Dashboard";
import Tournaments      from "./pages/director/Tournaments";
import Matches          from "./pages/director/Matches";
import Players          from "./pages/director/Players";
import Sponsors         from "./pages/director/Sponsors";
import Venues           from "./pages/director/Venues";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public screens ── */}
          <Route path="/"                      element={<App />} />
          <Route path="/umpire"                element={<UmpirePinEntry />} />
          <Route path="/umpire/:matchId/score" element={<UmpirePanel />} />

          {/* ── Director portal ── */}
          <Route path="/director/login" element={<DirectorLogin />} />
          <Route path="/director"       element={<DirectorLayout />}>
            <Route index                element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="tournaments"   element={<Tournaments />} />
            <Route path="matches"       element={<Matches />} />
            <Route path="players"       element={<Players />} />
            <Route path="sponsors"      element={<Sponsors />} />
            <Route path="venues"        element={<Venues />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
