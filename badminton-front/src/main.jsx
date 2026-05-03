// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import UmpirePinEntry from "./pages/UmpirePinEntry";
import UmpirePanel from "./pages/UmpirePanel";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Big screen — URL can carry ?match=<id> for multi-court */}
        <Route path="/" element={<App />} />

        {/* Umpire entry — no match ID in URL, umpire selects from list */}
        <Route path="/umpire" element={<UmpirePinEntry />} />

        {/* Umpire scoring panel — match ID set after PIN verified */}
        <Route path="/umpire/:matchId/score" element={<UmpirePanel />} />
      </Routes>
    </BrowserRouter>
    ,
  </React.StrictMode>,
);
