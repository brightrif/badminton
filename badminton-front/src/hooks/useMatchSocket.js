// src/hooks/useMatchSocket.js
//
// Shared WebSocket hook used by both:
//   - App.jsx (big screen viewer, read-only)
//   - UmpirePanel.jsx (umpire, read/write with token)
//
// Usage:
//   const { state, isConnected, sendAction } = useMatchSocket(matchId, token);
//
// `token` is optional — pass it only from the umpire panel.
// `sendAction` is a no-op for viewer connections (no token).

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

const initialState = {
  matchId: null,
  status: null,          // 'Upcoming' | 'Live' | 'Completed'
  currentGame: 1,
  team1Sets: 0,
  team2Sets: 0,
  team1Score: 0,
  team2Score: 0,
  serverId: null,
  gameScores: [],        // [{ game_number, team1_score, team2_score }]
  gameWon: false,
  matchWon: false,
  winner: null,          // 1 | 2 | null
  lastAction: null,      // last action type for animation triggers
  isUmpire: false,       // confirmed by server on connect
};

export function useMatchSocket(matchId, token = null) {
  const [state, setState] = useState(initialState);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const intentionalClose = useRef(false);

  const buildUrl = useCallback(() => {
    let url = `${WS_BASE}/ws/match/${matchId}/`;
    if (token) url += `?token=${encodeURIComponent(token)}`;
    return url;
  }, [matchId, token]);

  const connect = useCallback(() => {
    if (!matchId) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(buildUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'error') {
          setConnectionError(data.error);
          return;
        }

        if (data.type === 'score_update') {
          setState(prev => ({
            ...prev,
            matchId: data.match_id ?? prev.matchId,
            status: data.status ?? prev.status,
            currentGame: data.current_game ?? prev.currentGame,
            team1Sets: data.team1_sets ?? prev.team1Sets,
            team2Sets: data.team2_sets ?? prev.team2Sets,
            team1Score: data.team1_score ?? prev.team1Score,
            team2Score: data.team2_score ?? prev.team2Score,
            serverId: data.server_id ?? prev.serverId,
            gameScores: data.game_scores ?? prev.gameScores,
            gameWon: data.game_won ?? false,
            matchWon: data.match_won ?? false,
            winner: data.winner ?? null,
            lastAction: data.action ?? null,
            isUmpire: data.is_umpire ?? prev.isUmpire,
          }));
        }
      } catch (e) {
        console.error('[useMatchSocket] Parse error:', e);
      }
    };

    ws.onerror = () => {
      setConnectionError('WebSocket error. Attempting to reconnect…');
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      if (!intentionalClose.current && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };
  }, [buildUrl, matchId]);

  useEffect(() => {
    intentionalClose.current = false;
    connect();

    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // Send a scoring action — only works if we have a valid umpire token
  const sendAction = useCallback((payload) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setConnectionError('Not connected. Please wait…');
      return;
    }
    wsRef.current.send(JSON.stringify(payload));
  }, []);

  return { state, isConnected, connectionError, sendAction };
}
