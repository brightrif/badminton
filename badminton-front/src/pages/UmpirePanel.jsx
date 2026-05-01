// src/pages/UmpirePanel.jsx
//
// Route: /umpire/:matchId/score
// Token is loaded from localStorage (set by UmpirePinEntry).
//
// Layout (mobile-first, portrait):
//
//   ┌─────────────────────────────┐
//   │  Header: match info + game  │
//   ├──────────────┬──────────────┤
//   │  Team 1 name │  Team 2 name │
//   │  + serving   │  + serving   │
//   ├──────────────┼──────────────┤
//   │     Big score display       │
//   ├──────────────┬──────────────┤
//   │  [+POINT T1] │  [+POINT T2] │
//   ├──────────────┴──────────────┤
//   │  Set history pills          │
//   ├─────────────────────────────┤
//   │  [Undo T1]  [🎾]  [Undo T2] │
//   │  [Start Match / End Match]  │
//   └─────────────────────────────┘

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMatchSocket } from '../hooks/useMatchSocket';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function UmpirePanel() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  // Load token
  const token = localStorage.getItem(`umpire_token_${matchId}`);
  useEffect(() => {
    if (!token) navigate(`/umpire/${matchId}`, { replace: true });
  }, [token, matchId, navigate]);

  const { state, isConnected, connectionError, sendAction } = useMatchSocket(matchId, token);

  const [matchMeta, setMatchMeta] = useState(null);
  const [lastScored, setLastScored] = useState(null);   // 1 | 2 for flash animation
  const [gameWonBanner, setGameWonBanner] = useState(false);
  const prevScoreRef = useRef({ t1: 0, t2: 0 });

  // Flash animation on score change
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

  // Game won banner
  useEffect(() => {
    if (state.gameWon) {
      setGameWonBanner(true);
      const t = setTimeout(() => setGameWonBanner(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.gameWon, state.currentGame]);

  // Fetch static match metadata (names, types) once
  useEffect(() => {
    if (!matchId) return;
    fetch(`${API_BASE}/matches/${matchId}/`)
      .then(r => r.json())
      .then(setMatchMeta)
      .catch(() => {});
  }, [matchId]);

  const handlePoint = (team) => {
    if (state.status !== 'Live') return;
    sendAction({ action: 'point', team });
  };

  const handleUndo = (team) => {
    if (state.status !== 'Live') return;
    sendAction({ action: 'undo', team });
  };

  const handleSetServer = (playerId) => {
    sendAction({ action: 'set_server', player_id: playerId });
  };

  const handleStartMatch = () => sendAction({ action: 'start_match' });
  const handleEndMatch = () => {
    if (!window.confirm('End this match? This cannot be undone.')) return;
    sendAction({ action: 'end_match' });
  };

  const handleLogout = () => {
    localStorage.removeItem(`umpire_token_${matchId}`);
    navigate(`/umpire/${matchId}`);
  };

  // Derive player list from match meta
  const players = matchMeta ? [
    { id: matchMeta.player1_team1?.id, name: matchMeta.player1_team1?.name, team: 1 },
    matchMeta.player2_team1 && { id: matchMeta.player2_team1?.id, name: matchMeta.player2_team1?.name, team: 1 },
    { id: matchMeta.player1_team2?.id, name: matchMeta.player1_team2?.name, team: 2 },
    matchMeta.player2_team2 && { id: matchMeta.player2_team2?.id, name: matchMeta.player2_team2?.name, team: 2 },
  ].filter(Boolean) : [];

  const team1Name = matchMeta
    ? [matchMeta.player1_team1?.name, matchMeta.player2_team1?.name].filter(Boolean).join(' / ')
    : 'Team 1';
  const team2Name = matchMeta
    ? [matchMeta.player1_team2?.name, matchMeta.player2_team2?.name].filter(Boolean).join(' / ')
    : 'Team 2';

  const isLive = state.status === 'Live';
  const isUpcoming = state.status === 'Upcoming';
  const isCompleted = state.status === 'Completed';

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* ── Connection banner ── */}
      {!isConnected && (
        <div style={S.connBanner}>
          {connectionError || 'Connecting…'}
        </div>
      )}

      {/* ── Game Won Banner ── */}
      {gameWonBanner && (
        <div style={S.gameWonBanner} className="pop-in">
          🏸 GAME {state.currentGame - 1} WON!
        </div>
      )}

      {/* ── Match Won Banner ── */}
      {state.matchWon && (
        <div style={S.matchWonBanner} className="pop-in">
          🏆 MATCH WON · {state.winner === 1 ? team1Name : team2Name}
        </div>
      )}

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.matchLabel}>Match #{matchId}</span>
          <span style={{ ...S.statusBadge, background: statusColor(state.status) }}>
            {state.status || '…'}
          </span>
        </div>
        <div style={S.headerRight}>
          <span style={S.gameLabel}>Game {state.currentGame}</span>
          <button style={S.logoutBtn} onClick={handleLogout}>EXIT</button>
        </div>
      </header>

      {/* ── Set score row ── */}
      <div style={S.setsRow}>
        <div style={S.setsBlock}>
          <span style={S.setsLabel}>SETS</span>
          {[0,1].map(i => (
            <span key={i} style={{
              ...S.setDot,
              background: i < state.team1Sets ? '#e8ff47' : 'rgba(255,255,255,0.12)'
            }} />
          ))}
        </div>

        <div style={S.gameHistory}>
          {state.gameScores.map(gs => (
            <span key={gs.game_number} style={S.gameHistoryPill}>
              G{gs.game_number}: {gs.team1_score}–{gs.team2_score}
            </span>
          ))}
        </div>

        <div style={{ ...S.setsBlock, justifyContent: 'flex-end' }}>
          {[0,1].map(i => (
            <span key={i} style={{
              ...S.setDot,
              background: i < state.team2Sets ? '#e8ff47' : 'rgba(255,255,255,0.12)'
            }} />
          ))}
          <span style={S.setsLabel}>SETS</span>
        </div>
      </div>

      {/* ── Team names + serving ── */}
      <div style={S.teamsRow}>
        <div style={S.teamName}>
          <span>{team1Name}</span>
          {state.serverId && players.find(p => p.id === state.serverId && p.team === 1) && (
            <span style={S.servingDot} title="Serving" />
          )}
        </div>
        <div style={S.vsText}>VS</div>
        <div style={{ ...S.teamName, textAlign: 'right' }}>
          {state.serverId && players.find(p => p.id === state.serverId && p.team === 2) && (
            <span style={S.servingDot} />
          )}
          <span>{team2Name}</span>
        </div>
      </div>

      {/* ── Score display ── */}
      <div style={S.scoreRow}>
        <div style={{
          ...S.bigScore,
          color: lastScored === 1 ? '#e8ff47' : '#fff',
          transform: lastScored === 1 ? 'scale(1.08)' : 'scale(1)',
        }}>
          {state.team1Score}
        </div>
        <div style={S.scoreDivider}>–</div>
        <div style={{
          ...S.bigScore,
          color: lastScored === 2 ? '#e8ff47' : '#fff',
          transform: lastScored === 2 ? 'scale(1.08)' : 'scale(1)',
        }}>
          {state.team2Score}
        </div>
      </div>

      {/* ── Point buttons ── */}
      <div style={S.pointBtns}>
        <button
          style={{ ...S.pointBtn, ...(isLive ? {} : S.disabledBtn) }}
          onPointerDown={() => handlePoint(1)}
          disabled={!isLive}
        >
          <span style={S.plusSign}>+</span>
          <span style={S.pointLabel}>POINT</span>
        </button>
        <button
          style={{ ...S.pointBtn, ...(isLive ? {} : S.disabledBtn) }}
          onPointerDown={() => handlePoint(2)}
          disabled={!isLive}
        >
          <span style={S.plusSign}>+</span>
          <span style={S.pointLabel}>POINT</span>
        </button>
      </div>

      {/* ── Serving selector (doubles shows both players) ── */}
      {players.length > 0 && isLive && (
        <div style={S.servingSection}>
          <span style={S.servingTitle}>🎾 SERVING</span>
          <div style={S.servingBtns}>
            {players.map(p => (
              <button
                key={p.id}
                style={{
                  ...S.servingBtn,
                  ...(state.serverId === p.id ? S.servingBtnActive : {}),
                }}
                onClick={() => handleSetServer(p.id)}
              >
                {p.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Undo buttons ── */}
      <div style={S.undoRow}>
        <button
          style={{ ...S.undoBtn, ...(isLive ? {} : S.disabledBtn) }}
          onClick={() => handleUndo(1)}
          disabled={!isLive}
        >
          ↩ UNDO T1
        </button>
        <button
          style={{ ...S.undoBtn, ...(isLive ? {} : S.disabledBtn) }}
          onClick={() => handleUndo(2)}
          disabled={!isLive}
        >
          UNDO T2 ↪
        </button>
      </div>

      {/* ── Match controls ── */}
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
        {isCompleted && (
          <div style={S.completedMsg}>✓ MATCH COMPLETED</div>
        )}
      </div>
    </div>
  );
}

function statusColor(s) {
  if (s === 'Live') return '#22c55e';
  if (s === 'Completed') return '#94a3b8';
  return '#f59e0b';
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100dvh',
    background: '#0c0f0c',
    color: '#fff',
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    padding: '0 0 24px',
    position: 'relative',
    overflowX: 'hidden',
  },
  connBanner: {
    background: '#1a1a1a',
    borderBottom: '1px solid #f59e0b',
    color: '#f59e0b',
    textAlign: 'center',
    fontSize: '13px',
    padding: '8px',
    fontFamily: "'DM Sans', sans-serif",
  },
  gameWonBanner: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: '#e8ff47',
    color: '#0c0f0c',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '42px',
    letterSpacing: '4px',
    padding: '20px 40px',
    borderRadius: '16px',
    zIndex: 100,
    textAlign: 'center',
    boxShadow: '0 0 60px rgba(232,255,71,0.5)',
  },
  matchWonBanner: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(12,15,12,0.92)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '36px',
    letterSpacing: '4px',
    color: '#e8ff47',
    zIndex: 200,
    textAlign: 'center',
    padding: '24px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  matchLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '20px',
    letterSpacing: '2px',
    color: 'rgba(255,255,255,0.7)',
  },
  statusBadge: {
    fontSize: '11px',
    fontWeight: '600',
    padding: '3px 10px',
    borderRadius: '20px',
    color: '#fff',
    letterSpacing: '0.5px',
  },
  gameLabel: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '18px',
    letterSpacing: '2px',
    color: '#e8ff47',
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '11px',
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: '1px',
    padding: '6px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  setsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
  },
  setsBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    minWidth: '80px',
  },
  setsLabel: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '1px',
    color: 'rgba(255,255,255,0.35)',
  },
  setDot: {
    width: '12px', height: '12px',
    borderRadius: '50%',
    transition: 'background 0.3s ease',
  },
  gameHistory: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    flex: 1,
    padding: '0 8px',
  },
  gameHistoryPill: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '2px 10px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: "'DM Mono', monospace",
  },
  teamsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 20px 0',
    gap: '8px',
  },
  teamName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    lineHeight: 1.3,
  },
  vsText: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.2)',
    letterSpacing: '2px',
  },
  servingDot: {
    width: '8px', height: '8px',
    borderRadius: '50%',
    background: '#e8ff47',
    boxShadow: '0 0 8px rgba(232,255,71,0.8)',
    flexShrink: 0,
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '8px 20px 16px',
  },
  bigScore: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 'clamp(88px, 22vw, 120px)',
    lineHeight: 1,
    transition: 'color 0.3s ease, transform 0.15s ease',
    minWidth: '1ch',
    textAlign: 'center',
  },
  scoreDivider: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '48px',
    color: 'rgba(255,255,255,0.2)',
    lineHeight: 1,
  },
  pointBtns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '0 16px 16px',
  },
  pointBtn: {
    background: 'rgba(232,255,71,0.1)',
    border: '2px solid #e8ff47',
    borderRadius: '16px',
    padding: '24px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    active: {
      background: 'rgba(232,255,71,0.25)',
      transform: 'scale(0.97)',
    },
  },
  plusSign: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '48px',
    color: '#e8ff47',
    lineHeight: 1,
  },
  pointLabel: {
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: '#e8ff47',
    marginTop: '2px',
  },
  disabledBtn: {
    opacity: 0.25,
    cursor: 'not-allowed',
    border: '2px solid rgba(255,255,255,0.15)',
  },
  servingSection: {
    padding: '0 16px 16px',
  },
  servingTitle: {
    fontSize: '12px',
    fontWeight: '700',
    letterSpacing: '1.5px',
    color: 'rgba(255,255,255,0.4)',
    display: 'block',
    marginBottom: '10px',
    textAlign: 'center',
  },
  servingBtns: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  servingBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '8px',
    padding: '10px 18px',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif",
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  servingBtnActive: {
    background: 'rgba(232,255,71,0.12)',
    border: '1px solid #e8ff47',
    color: '#e8ff47',
  },
  undoRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '0 16px 16px',
  },
  undoBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '14px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: '600',
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  matchControls: {
    padding: '0 16px',
    marginTop: 'auto',
  },
  startBtn: {
    width: '100%',
    padding: '18px',
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '20px',
    letterSpacing: '3px',
    cursor: 'pointer',
  },
  endBtn: {
    width: '100%',
    padding: '18px',
    background: 'transparent',
    color: 'rgba(255,100,100,0.8)',
    border: '1px solid rgba(255,100,100,0.3)',
    borderRadius: '12px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '18px',
    letterSpacing: '2px',
    cursor: 'pointer',
  },
  completedMsg: {
    textAlign: 'center',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '18px',
    letterSpacing: '3px',
    color: '#22c55e',
    padding: '18px',
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0c0f0c; }

  .pop-in {
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
  }
  @keyframes popIn {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.7); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  button:active:not(:disabled) {
    transform: scale(0.96);
  }
`;
