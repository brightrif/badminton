// src/hooks/useMatchSocket.js
//
// Fix: sendAction no longer uses useCallback.
// It reads wsRef.current at the moment it is called, so it always
// sees the live socket regardless of when the function was created.

import { useEffect, useRef, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000";
const MAX_RECONNECT_ATTEMPTS = 10;

const initialState = {
  matchId: null,
  status: null,
  currentGame: 1,
  team1Sets: 0,
  team2Sets: 0,
  team1Score: 0,
  team2Score: 0,
  serverId: null,
  gameScores: [],
  gameWon: false,
  matchWon: false,
  winner: null,
  lastAction: null,
  isUmpire: false,
};

export function useMatchSocket(matchId, token = null) {
  const [state, setState] = useState(initialState);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const cancelled = useRef(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);

  // Keep a ref to the latest token so buildUrl is always current
  // without needing to be in the effect dependency array.
  const tokenRef = useRef(token);
  const matchIdRef = useRef(matchId);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    matchIdRef.current = matchId;
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;

    cancelled.current = false;
    reconnectAttempts.current = 0;

    const buildUrl = () => {
      let url = `${WS_BASE}/ws/match/${matchIdRef.current}/`;
      if (tokenRef.current)
        url += `?token=${encodeURIComponent(tokenRef.current)}`;
      return url;
    };

    // Defer by one tick — this is what makes StrictMode safe.
    // StrictMode cleanup sets cancelled.current = true before this fires,
    // so the socket is never created for the throwaway first mount.
    const connectTimer = setTimeout(connect, 0);

    function connect() {
      if (cancelled.current) return;

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(buildUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled.current) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        if (cancelled.current) return;
        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        if (data.type === "error") {
          setConnectionError(data.error);
          return;
        }

        if (data.type === "score_update") {
          setState({
            matchId: data.match_id ?? null,
            status: data.status ?? null,
            currentGame: data.current_game ?? 1,
            team1Sets: data.team1_sets ?? 0,
            team2Sets: data.team2_sets ?? 0,
            team1Score: data.team1_score ?? 0,
            team2Score: data.team2_score ?? 0,
            serverId: data.server_id ?? null,
            gameScores: data.game_scores ?? [],
            gameWon: data.game_won ?? false,
            matchWon: data.match_won ?? false,
            winner: data.winner ?? null,
            lastAction: data.action ?? null,
            isUmpire: data.is_umpire ?? false,
          });
        }
      };

      ws.onerror = () => {
        // always followed by onclose — handle there
      };

      ws.onclose = (event) => {
        if (cancelled.current) return;
        wsRef.current = null;
        setIsConnected(false);

        if (event.code === 1000 || event.code === 4003) return;

        if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError("Could not reconnect. Please refresh the page.");
          return;
        }

        const delay = Math.min(3000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current += 1;
        setConnectionError(
          `Connection lost. Reconnecting in ${Math.round(delay / 1000)}s…`,
        );

        reconnectTimer.current = setTimeout(() => {
          if (cancelled.current) return;
          setConnectionError(null);
          connect();
        }, delay);
      };
    }

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
  }, [matchId, token]);

  // ── sendAction ────────────────────────────────────────────────────────────
  // NOT wrapped in useCallback — intentionally a plain function.
  // This means it is re-created on every render, which is what we want:
  // every call gets a fresh read of wsRef.current so it always sees the
  // live socket, never a stale one from a previous render cycle.
  function sendAction(payload) {
    const ws = wsRef.current;
    console.log("[sendAction] called", {
      payload,
      ws: ws ? `readyState=${ws.readyState}` : "NULL",
      // readyState: 0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED
    });
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setConnectionError("Not connected — please wait.");
      return;
    }
    ws.send(JSON.stringify(payload));
  }

  return { state, isConnected, connectionError, sendAction };
}
