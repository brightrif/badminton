// src/pages/UmpirePanel.jsx
// Fix: removed useCallback from all action handlers.
// Every render gets a fresh sendAction from the hook, and the handlers
// call it directly — no stale closure can form.

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMatchSocket } from "../hooks/useMatchSocket";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export default function UmpirePanel() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const token =
    sessionStorage.getItem(`umpire_token_${matchId}`) ||
    localStorage.getItem(`umpire_token_${matchId}`);

  useEffect(() => {
    if (!token) navigate("/umpire", { replace: true });
  }, [token, matchId, navigate]);

  const { state, isConnected, connectionError, sendAction } = useMatchSocket(
    matchId,
    token,
  );

  const [matchMeta, setMatchMeta] = useState(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaError, setMetaError] = useState(null);
  const [lastScored, setLastScored] = useState(null);
  const [gameWonBanner, setGameWonBanner] = useState(false);

  const prevScoreRef = useRef({ t1: 0, t2: 0 });

  // ── Fetch static match metadata ──────────────────────────────────────────
  useEffect(() => {
    if (!matchId) return;
    setMetaLoading(true);
    fetch(`${API_BASE}/matches/${matchId}/`)
      .then((r) => {
        if (!r.ok) throw new Error(`Match not found (${r.status})`);
        return r.json();
      })
      .then((d) => {
        setMatchMeta(d);
        setMetaLoading(false);
      })
      .catch((e) => {
        setMetaError(e.message);
        setMetaLoading(false);
      });
  }, [matchId]);

  // ── Score flash ──────────────────────────────────────────────────────────
  useEffect(() => {
    const { t1, t2 } = prevScoreRef.current;
    if (state.team1Score !== t1) {
      setLastScored(1);
      setTimeout(() => setLastScored(null), 600);
    } else if (state.team2Score !== t2) {
      setLastScored(2);
      setTimeout(() => setLastScored(null), 600);
    }
    prevScoreRef.current = { t1: state.team1Score, t2: state.team2Score };
  }, [state.team1Score, state.team2Score]);

  // ── Game won banner ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state.gameWon) {
      setGameWonBanner(true);
      const t = setTimeout(() => setGameWonBanner(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.gameWon, state.currentGame]);

  // ── Action handlers — plain functions, NO useCallback ───────────────────
  // Each render gets a fresh sendAction from the hook. These functions
  // close over that fresh sendAction, so they never go stale.
  const handlePoint = (team) => {
    if (state.status !== "Live") return;
    sendAction({ action: "point", team });
  };

  const handleUndo = (team) => {
    if (state.status !== "Live") return;
    sendAction({ action: "undo", team });
  };

  const handleSetServer = (id) => {
    sendAction({ action: "set_server", player_id: id });
  };

  const handleStartMatch = () => {
    sendAction({ action: "start_match" });
  };

  const handleEndMatch = () => {
    if (window.confirm("End this match? This cannot be undone."))
      sendAction({ action: "end_match" });
  };

  const handleLogout = () => {
    sessionStorage.removeItem(`umpire_token_${matchId}`);
    localStorage.removeItem(`umpire_token_${matchId}`);
    navigate("/umpire");
  };

  // ── Safe derived values ──────────────────────────────────────────────────
  const p1t1Name = matchMeta?.player1_team1_detail?.name ?? "";
  const p2t1Name = matchMeta?.player2_team1_detail?.name ?? "";
  const p1t2Name = matchMeta?.player1_team2_detail?.name ?? "";
  const p2t2Name = matchMeta?.player2_team2_detail?.name ?? "";

  const team1Name =
    [p1t1Name, p2t1Name].filter(Boolean).join(" / ") || "Team 1";
  const team2Name =
    [p1t2Name, p2t2Name].filter(Boolean).join(" / ") || "Team 2";

  const players = [
    p1t1Name && {
      id: matchMeta?.player1_team1_detail?.id,
      name: p1t1Name,
      team: 1,
    },
    p2t1Name && {
      id: matchMeta?.player2_team1_detail?.id,
      name: p2t1Name,
      team: 1,
    },
    p1t2Name && {
      id: matchMeta?.player1_team2_detail?.id,
      name: p1t2Name,
      team: 2,
    },
    p2t2Name && {
      id: matchMeta?.player2_team2_detail?.id,
      name: p2t2Name,
      team: 2,
    },
  ].filter(Boolean);

  const isLive = state.status === "Live";
  const isUpcoming = state.status === "Upcoming" || !state.status;
  const isCompleted = state.status === "Completed";

  // ── Loading / error screens ──────────────────────────────────────────────
  if (metaLoading) {
    return (
      <div style={S.page}>
        <style>{CSS}</style>
        <div style={S.centreMsg}>
          <div style={S.spinner} />
          <span style={S.centreMsgText}>Loading match {matchId}…</span>
        </div>
      </div>
    );
  }

  if (metaError) {
    return (
      <div style={S.page}>
        <style>{CSS}</style>
        <div style={S.centreMsg}>
          <div style={S.errorBox}>
            <div style={S.errorTitle}>Could not load match</div>
            <div style={S.errorDetail}>{metaError}</div>
            <button style={S.retryBtn} onClick={() => navigate("/umpire")}>
              ← Back to match list
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Connection banner */}
      {!isConnected && (
        <div style={S.connBanner}>
          {connectionError || "Connecting to match…"}
        </div>
      )}

      {/* Game won banner */}
      {gameWonBanner && (
        <div style={S.gameWonBanner}>
          🏸 GAME {Math.max(1, state.currentGame - 1)} OVER
        </div>
      )}

      {/* Match won overlay */}
      {state.matchWon && (
        <div style={S.matchWonOverlay}>
          <div style={S.matchWonTitle}>🏆 MATCH WON</div>
          <div style={S.matchWonTeam}>
            {state.winner === 1 ? team1Name : team2Name}
          </div>
        </div>
      )}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.matchLabel}>Match #{matchId}</span>
          <span
            style={{ ...S.statusBadge, background: statusColor(state.status) }}
          >
            {state.status ?? "…"}
          </span>
        </div>
        <div style={S.headerRight}>
          <span style={S.gameLabel}>Game {state.currentGame}</span>
          <button style={S.logoutBtn} onClick={handleLogout}>
            EXIT
          </button>
        </div>
      </header>

      {/* Set score row */}
      <div style={S.setsRow}>
        <div style={S.setsBlock}>
          <span style={S.setsLabel}>SETS</span>
          {[0, 1].map((i) => (
            <span
              key={i}
              style={{
                ...S.setDot,
                background:
                  i < state.team1Sets ? "#e8ff47" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
        <div style={S.gameHistory}>
          {(state.gameScores ?? []).map((gs) => (
            <span key={gs.game_number} style={S.gameHistoryPill}>
              G{gs.game_number}: {gs.team1_score}–{gs.team2_score}
            </span>
          ))}
        </div>
        <div style={{ ...S.setsBlock, justifyContent: "flex-end" }}>
          {[0, 1].map((i) => (
            <span
              key={i}
              style={{
                ...S.setDot,
                background:
                  i < state.team2Sets ? "#e8ff47" : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
          <span style={S.setsLabel}>SETS</span>
        </div>
      </div>

      {/* Team names */}
      <div style={S.teamsRow}>
        <div style={S.teamName}>
          {state.serverId &&
            players.find((p) => p?.id === state.serverId && p?.team === 1) && (
              <span style={S.servingDot} />
            )}
          <span>{team1Name}</span>
        </div>
        <div style={S.vsText}>VS</div>
        <div
          style={{
            ...S.teamName,
            textAlign: "right",
            justifyContent: "flex-end",
          }}
        >
          <span>{team2Name}</span>
          {state.serverId &&
            players.find((p) => p?.id === state.serverId && p?.team === 2) && (
              <span style={S.servingDot} />
            )}
        </div>
      </div>

      {/* Score display */}
      <div style={S.scoreRow}>
        <div
          style={{
            ...S.bigScore,
            color: lastScored === 1 ? "#e8ff47" : "#fff",
            transform: lastScored === 1 ? "scale(1.08)" : "scale(1)",
          }}
        >
          {state.team1Score}
        </div>
        <div style={S.scoreDivider}>–</div>
        <div
          style={{
            ...S.bigScore,
            color: lastScored === 2 ? "#e8ff47" : "#fff",
            transform: lastScored === 2 ? "scale(1.08)" : "scale(1)",
          }}
        >
          {state.team2Score}
        </div>
      </div>

      {/* Point buttons */}
      <div style={S.pointBtns}>
        {[1, 2].map((team) => (
          <button
            key={team}
            style={{ ...S.pointBtn, ...(isLive ? {} : S.disabledBtn) }}
            onPointerDown={() => handlePoint(team)}
            disabled={!isLive}
          >
            <span style={S.plusSign}>+</span>
            <span style={S.pointLabel}>POINT</span>
            <span style={S.pointTeamLabel}>
              {team === 1 ? team1Name : team2Name}
            </span>
          </button>
        ))}
      </div>

      {/* Serving selector */}
      {players.length > 0 && isLive && (
        <div style={S.servingSection}>
          <span style={S.servingTitle}>🎾 SERVING</span>
          <div style={S.servingBtns}>
            {players.map((p) => (
              <button
                key={p.id}
                style={{
                  ...S.servingBtn,
                  ...(state.serverId === p.id ? S.servingBtnActive : {}),
                }}
                onClick={() => handleSetServer(p.id)}
              >
                {p.name.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Undo buttons */}
      <div style={S.undoRow}>
        {[1, 2].map((team) => (
          <button
            key={team}
            style={{ ...S.undoBtn, ...(isLive ? {} : S.disabledBtn) }}
            onClick={() => handleUndo(team)}
            disabled={!isLive}
          >
            {team === 1 ? "↩ UNDO T1" : "UNDO T2 ↪"}
          </button>
        ))}
      </div>

      {/* Match controls */}
      <div style={S.matchControls}>
        {isUpcoming && (
          <button style={S.startBtn} onClick={handleStartMatch}>
            ▶ START MATCH
          </button>
        )}
        {isLive && (
          <button style={S.endBtn} onClick={handleEndMatch}>
            ■ END MATCH
          </button>
        )}
        {isCompleted && <div style={S.completedMsg}>✓ MATCH COMPLETED</div>}
      </div>
    </div>
  );
}

function statusColor(s) {
  if (s === "Live") return "#22c55e";
  if (s === "Completed") return "#94a3b8";
  return "#f59e0b";
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100dvh",
    background: "#0c0f0c",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
    display: "flex",
    flexDirection: "column",
    paddingBottom: "24px",
    position: "relative",
    overflowX: "hidden",
  },
  centreMsg: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "40px 24px",
  },
  centreMsgText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    letterSpacing: "1px",
  },
  spinner: {
    width: "32px",
    height: "32px",
    border: "3px solid rgba(255,255,255,0.1)",
    borderTop: "3px solid #e8ff47",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  errorBox: {
    background: "rgba(255,100,100,0.08)",
    border: "1px solid rgba(255,100,100,0.2)",
    borderRadius: "14px",
    padding: "28px 24px",
    maxWidth: "320px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  errorTitle: { fontSize: "18px", fontWeight: "700", color: "#ff8080" },
  errorDetail: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.35)",
    lineHeight: "1.5",
  },
  retryBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "8px",
    color: "rgba(255,255,255,0.5)",
    padding: "10px 16px",
    cursor: "pointer",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
    marginTop: "4px",
  },
  connBanner: {
    background: "#1a1a1a",
    borderBottom: "1px solid #f59e0b",
    color: "#f59e0b",
    textAlign: "center",
    fontSize: "13px",
    padding: "8px 16px",
  },
  gameWonBanner: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    background: "#e8ff47",
    color: "#0c0f0c",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "42px",
    letterSpacing: "4px",
    padding: "20px 40px",
    borderRadius: "16px",
    zIndex: 100,
    textAlign: "center",
    boxShadow: "0 0 60px rgba(232,255,71,0.5)",
    pointerEvents: "none",
  },
  matchWonOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(12,15,12,0.95)",
    zIndex: 200,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "24px",
    textAlign: "center",
  },
  matchWonTitle: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "48px",
    letterSpacing: "6px",
    color: "#e8ff47",
  },
  matchWonTeam: { fontSize: "22px", fontWeight: "700", color: "#fff" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: "10px" },
  headerRight: { display: "flex", alignItems: "center", gap: "12px" },
  matchLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "20px",
    letterSpacing: "2px",
    color: "rgba(255,255,255,0.7)",
  },
  statusBadge: {
    fontSize: "11px",
    fontWeight: "600",
    padding: "3px 10px",
    borderRadius: "20px",
    color: "#fff",
    letterSpacing: "0.5px",
  },
  gameLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "18px",
    letterSpacing: "2px",
    color: "#e8ff47",
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "rgba(255,255,255,0.4)",
    fontSize: "11px",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "1px",
    padding: "6px 12px",
    borderRadius: "6px",
    cursor: "pointer",
  },
  setsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
  },
  setsBlock: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    minWidth: "80px",
  },
  setsLabel: {
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "1px",
    color: "rgba(255,255,255,0.35)",
  },
  setDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    transition: "background 0.3s ease",
    display: "inline-block",
  },
  gameHistory: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
    justifyContent: "center",
    flex: 1,
    padding: "0 8px",
  },
  gameHistoryPill: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    color: "rgba(255,255,255,0.5)",
  },
  teamsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 20px 0",
    gap: "8px",
  },
  teamName: {
    flex: 1,
    fontSize: "14px",
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    lineHeight: 1.3,
  },
  vsText: {
    fontSize: "11px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.2)",
    letterSpacing: "2px",
  },
  servingDot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#e8ff47",
    boxShadow: "0 0 8px rgba(232,255,71,0.8)",
    flexShrink: 0,
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    padding: "8px 20px 16px",
  },
  bigScore: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "clamp(88px, 22vw, 120px)",
    lineHeight: 1,
    transition: "color 0.3s ease, transform 0.15s ease",
    minWidth: "1ch",
    textAlign: "center",
  },
  scoreDivider: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "48px",
    color: "rgba(255,255,255,0.2)",
    lineHeight: 1,
  },
  pointBtns: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    padding: "0 16px 16px",
  },
  pointBtn: {
    background: "rgba(232,255,71,0.1)",
    border: "2px solid #e8ff47",
    borderRadius: "16px",
    padding: "20px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    transition: "transform 0.1s ease",
    gap: "2px",
  },
  plusSign: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "48px",
    color: "#e8ff47",
    lineHeight: 1,
  },
  pointLabel: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "2px",
    color: "#e8ff47",
  },
  pointTeamLabel: {
    fontSize: "10px",
    color: "rgba(232,255,71,0.5)",
    letterSpacing: "0.5px",
    maxWidth: "120px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    padding: "0 8px",
  },
  disabledBtn: {
    opacity: 0.25,
    cursor: "not-allowed",
    border: "2px solid rgba(255,255,255,0.15)",
  },
  servingSection: { padding: "0 16px 16px" },
  servingTitle: {
    fontSize: "12px",
    fontWeight: "700",
    letterSpacing: "1.5px",
    color: "rgba(255,255,255,0.4)",
    display: "block",
    marginBottom: "10px",
    textAlign: "center",
  },
  servingBtns: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  servingBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    padding: "10px 18px",
    color: "rgba(255,255,255,0.6)",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  servingBtnActive: {
    background: "rgba(232,255,71,0.12)",
    border: "1px solid #e8ff47",
    color: "#e8ff47",
  },
  undoRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    padding: "0 16px 16px",
  },
  undoBtn: {
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    padding: "14px",
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: "600",
    letterSpacing: "1px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  matchControls: { padding: "0 16px", marginTop: "auto" },
  startBtn: {
    width: "100%",
    padding: "18px",
    background: "#22c55e",
    color: "#fff",
    border: "none",
    borderRadius: "12px",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "20px",
    letterSpacing: "3px",
    cursor: "pointer",
  },
  endBtn: {
    width: "100%",
    padding: "18px",
    background: "transparent",
    color: "rgba(255,100,100,0.8)",
    border: "1px solid rgba(255,100,100,0.3)",
    borderRadius: "12px",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "18px",
    letterSpacing: "2px",
    cursor: "pointer",
  },
  completedMsg: {
    textAlign: "center",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "18px",
    letterSpacing: "3px",
    color: "#22c55e",
    padding: "18px",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0c0f0c; }
  @keyframes spin { to { transform: rotate(360deg); } }
  button:active:not(:disabled) { transform: scale(0.96); }
`;
