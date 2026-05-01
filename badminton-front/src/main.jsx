// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import App from './App';
import UmpirePinEntry from './pages/UmpirePinEntry';
import UmpirePanel from './pages/UmpirePanel';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Big screen display — existing app */}
        <Route path="/" element={<App />} />

        {/* Umpire flow */}
        {/* Step 1: PIN entry */}
        <Route path="/umpire/:matchId" element={<UmpirePinEntry />} />
        {/* Step 2: Live scoring panel */}
        <Route path="/umpire/:matchId/score" element={<UmpirePanel />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
