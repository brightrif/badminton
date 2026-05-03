import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// ── Existing public screens (unchanged) ───────────────────────────────────────
import App            from "./App";
import UmpirePinEntry from "./pages/UmpirePinEntry";
import UmpirePanel    from "./pages/UmpirePanel";

// ── Director portal (new) ─────────────────────────────────────────────────────
import { AuthProvider }   from "./context/AuthContext";
import DirectorLayout     from "./pages/director/DirectorLayout";
import DirectorLogin      from "./pages/director/Login";
import DirectorDashboard  from "./pages/director/Dashboard";
import DirectorTournaments from "./pages/director/Tournaments";
import DirectorMatches    from "./pages/director/Matches";
import DirectorPlayers    from "./pages/director/Players";
import DirectorSponsors   from "./pages/director/Sponsors";
import DirectorVenues     from "./pages/director/Venues";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/*
      AuthProvider wraps everything so director context is available under /director/*.
      The big screen (/) and umpire (/umpire) routes never call useAuth so they are
      completely unaffected — AuthProvider is just a context that sits idle for them.
    */}
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public screens */}
          <Route path="/"                      element={<App />} />
          <Route path="/umpire"                element={<UmpirePinEntry />} />
          <Route path="/umpire/:matchId/score" element={<UmpirePanel />} />

          {/* Director portal */}
          <Route path="/director/login" element={<DirectorLogin />} />
          <Route path="/director"       element={<DirectorLayout />}>
            <Route index                element={<DirectorDashboard />} />
            <Route path="dashboard"     element={<DirectorDashboard />} />
            <Route path="tournaments"   element={<DirectorTournaments />} />
            <Route path="matches"       element={<DirectorMatches />} />
            <Route path="players"       element={<DirectorPlayers />} />
            <Route path="sponsors"      element={<DirectorSponsors />} />
            <Route path="venues"        element={<DirectorVenues />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
