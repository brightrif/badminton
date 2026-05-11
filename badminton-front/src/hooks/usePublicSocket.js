// src/hooks/usePublicSocket.js
//
// Read-only WebSocket hook for the spectator portal.
// No token required — connects to the same match channel as the umpire
// but only listens for score_update broadcasts. Cannot send any actions.
//
// Usage:
//   const { score, isConnected } = usePublicSocket(matchId);
//
//   score = {
//     status        : "Live" | "Completed" | "Upcoming" | null
//     team1Score    : number   (current game)
//     team2Score    : number   (current game)
//     team1Sets     : number
//     team2Sets     : number
//     currentGame   : number
//     gameScores    : [{ game_number, team1_score, team2_score }]
//     matchWon      : boolean  — true the moment the match ends
//     winner        : 1 | 2 | null
//     serverId      : number | null
//   }
//
// Behaviour:
//   - Auto-reconnects with exponential backoff (max 10 attempts, cap 30 s)
//   - Stops reconnecting on code 1000 (clean close) or 4003 (rejected)
//   - StrictMode-safe: defers socket creation by one tick so the
//     StrictMode double-mount cleanup fires before the socket opens
//   - Pass matchId=null to stay idle (nothing connects)
//   - Each matchId change tears down the old socket and opens a fresh one

import { useEffect, useRef, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
const MAX_RECONNECT_ATTEMPTS = 10;

const initialScore = {
  status: null,
  team1Score: 0,
  team2Score: 0,
  team1Sets: 0,
  team2Sets: 0,
  currentGame: 1,
  gameScores: [],
  matchWon: false,
  winner: null,
  serverId: null,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePublicSocket(matchId) {
  const [score, setScore] = useState(initialScore);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const cancelled = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);
  const matchIdRef = useRef(matchId);

  // Keep matchIdRef current so buildUrl always uses the latest value
  // without the ref being in the effect dependency array.
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  useEffect(() => {
    // Nothing to connect to
    if (!matchId) return;

    cancelled.current = false;
    reconnectAttempts.current = 0;

    // No token — spectators connect without authentication.
    // The consumer accepts unauthenticated connections and broadcasts
    // score_update events to everyone in the group.
    const buildUrl = () => `${WS_BASE}/ws/match/${matchIdRef.current}/`;

    // Defer by one tick — StrictMode fires the cleanup synchronously
    // before this runs, so we never open a socket for the throwaway mount.
    const connectTimer = setTimeout(connect, 0);

    function connect() {
      if (cancelled.current) return;

      // Reset score state on every fresh connection so stale values
      // from a previous match never bleed into the new one.
      setScore(initialScore);

      // Close any existing socket cleanly before opening a new one.
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(buildUrl());
      wsRef.current = ws;

      // ── open ────────────────────────────────────────────────────────────
      ws.onopen = () => {
        if (cancelled.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      // ── message ─────────────────────────────────────────────────────────
      ws.onmessage = (event) => {
        if (cancelled.current) return;

        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return; // ignore malformed frames
        }

        // Server-side error (e.g. invalid token on other hooks — not
        // expected here, but handle gracefully anyway)
        if (data.type === "error") {
          setConnectionError(data.error);
          return;
        }

        // Main payload — same shape the umpire hook receives
        if (data.type === "score_update") {
          setScore({
            status: data.status ?? null,
            team1Score: data.team1_score ?? 0,
            team2Score: data.team2_score ?? 0,
            team1Sets: data.team1_sets ?? 0,
            team2Sets: data.team2_sets ?? 0,
            currentGame: data.current_game ?? 1,
            gameScores: data.game_scores ?? [],
            matchWon: data.match_won ?? false,
            winner: data.winner ?? null,
            serverId: data.server_id ?? null,
          });
        }
      };

      // ── error ───────────────────────────────────────────────────────────
      ws.onerror = () => {
        // Always followed by onclose — all recovery handled there.
      };

      // ── close ───────────────────────────────────────────────────────────
      ws.onclose = (event) => {
        if (cancelled.current) return;

        wsRef.current = null;
        setIsConnected(false);

        // 1000 = clean close (match ended), 4003 = explicitly rejected
        // — no point retrying either.
        if (event.code === 1000 || event.code === 4003) return;

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError("Could not reconnect. Please refresh the page.");
          return;
        }

        // Exponential backoff: 3 s, 6 s, 12 s … capped at 30 s
        const delay = Math.min(3000 * 2 ** reconnectAttempts.current, 30_000);
        reconnectAttempts.current += 1;
        setConnectionError(`Reconnecting in ${Math.round(delay / 1000)}s…`);

        reconnectTimer.current = setTimeout(() => {
          if (cancelled.current) return;
          setConnectionError(null);
          connect();
        }, delay);
      };
    }

    // ── cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelled.current = true;
      clearTimeout(connectTimer);
      clearTimeout(reconnectTimer.current);

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      setIsConnected(false);
    };
  }, [matchId]); // re-run whenever the match changes

  return { score, isConnected, connectionError };
}
