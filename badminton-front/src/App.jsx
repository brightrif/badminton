// src/App.jsx
//
// Big-screen scoreboard — displayed on the venue projector/TV.
// Driven entirely by WebSocket via useMatchSocket (no polling).
//
// Design direction: BROADCAST-GRADE / STADIUM
//   - Full-bleed dark court atmosphere
//   - Giant typography that reads from 20 metres
//   - Yellow accent (#e8ff47) as the single dominant pop colour
//   - Score changes trigger a cinematic flash pulse
//   - Game-win and match-win moments get full-screen celebration overlays
//   - Sponsors carousel at the bottom, slow fade-cycle

import { useState, useEffect, useRef } from "react";
import { Dot } from "lucide-react";
import PlayerCard from "./components/PlayerCard";
import SponsorDisplay from "./components/SponsorDisplay";
import { useMatchSocket } from "./hooks/useMatchSocket";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ─── Match selector ───────────────────────────────────────────────────────────
// The big screen needs to know WHICH match to connect to.
// We fetch the first live (or upcoming) match from the REST API once on mount,
// then hand the id to useMatchSocket.  After that, all updates come via WS.

export default function App() {
  const [matchId, setMatchId] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null); // static player/tournament info
  const [sponsors, setSponsors] = useState([]);
  const [bootstrapError, setBootstrapError] = useState(null);

  // Score flash state
  const [flashTeam, setFlashTeam] = useState(null); // 1 | 2
  const prevScores = useRef({ t1: null, t2: null });

  // Overlay states
  const [gameWonOverlay, setGameWonOverlay] = useState(null); // { winner: 1|2, game: n }
  const [matchWonOverlay, setMatchWonOverlay] = useState(null); // { winner: 1|2 }

  // Sponsor carousel
  const [sponsorIndex, setSponsorIndex] = useState(0);

  // ── 1. Bootstrap: fetch match id + static metadata ──────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Try live first, fall back to upcoming
        let res = await fetch(`${API_BASE}/matches/live/`);
        let data = await res.json();
        let arr = Array.isArray(data) ? data : (data.results ?? []);

        if (arr.length === 0) {
          res = await fetch(`${API_BASE}/matches/upcoming/`);
          data = await res.json();
          arr = Array.isArray(data) ? data : (data.results ?? []);
        }

        if (arr.length === 0) {
          setBootstrapError("No matches scheduled.");
          return;
        }

        const match = arr[0];
        setMatchId(match.id);

        // Fetch full match detail for player photos / names
        const detailRes = await fetch(`${API_BASE}/matches/${match.id}/`);
        const detail = await detailRes.json();
        setMatchMeta(detail);

        // Fetch sponsors for this tournament (once — they don't change live)
        const sRes = await fetch(
          `${API_BASE}/sponsors/?tournament=${match.tournament}`,
        );
        const sData = await sRes.json();
        setSponsors(Array.isArray(sData) ? sData : (sData.results ?? []));
      } catch (e) {
        console.error("[App] bootstrap error:", e);
        setBootstrapError("Could not load match data.");
      }
    };

    bootstrap();
  }, []);

  // ── 2. Live score via WebSocket ──────────────────────────────────────────────
  // No token — big screen is viewer-only
  const { state, isConnected } = useMatchSocket(matchId);

  // ── 3. React to score changes ────────────────────────────────────────────────
  useEffect(() => {
    const { t1, t2 } = prevScores.current;
    if (t1 === null) {
      prevScores.current = { t1: state.team1Score, t2: state.team2Score };
      return;
    }

    if (state.team1Score !== t1) {
      triggerFlash(1);
    } else if (state.team2Score !== t2) {
      triggerFlash(2);
    }

    prevScores.current = { t1: state.team1Score, t2: state.team2Score };
  }, [state.team1Score, state.team2Score]);

  // ── 4. Game won / match won overlays ────────────────────────────────────────
  useEffect(() => {
    if (state.gameWon && !state.matchWon) {
      setGameWonOverlay({
        winner: state.lastAction === "point" ? state.winner : null,
        game: state.currentGame - 1,
      });
      const t = setTimeout(() => setGameWonOverlay(null), 3500);
      return () => clearTimeout(t);
    }
  }, [state.gameWon, state.currentGame]);

  useEffect(() => {
    if (state.matchWon) {
      setMatchWonOverlay({ winner: state.winner });
    }
  }, [state.matchWon, state.winner]);

  // ── 5. Sponsor carousel ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sponsors.length <= 1) return;
    const t = setInterval(() => {
      setSponsorIndex((i) => (i + 1) % sponsors.length);
    }, 4000);
    return () => clearInterval(t);
  }, [sponsors.length]);

  const triggerFlash = (team) => {
    setFlashTeam(team);
    setTimeout(() => setFlashTeam(null), 700);
  };

  // ── Derived display values ───────────────────────────────────────────────────
  const team1Name = matchMeta
    ? [
        matchMeta.player1_team1_detail?.name,
        matchMeta.player2_team1_detail?.name,
      ]
        .filter(Boolean)
        .join(" / ")
    : "Team 1";

  const team2Name = matchMeta
    ? [
        matchMeta.player1_team2_detail?.name,
        matchMeta.player2_team2_detail?.name,
      ]
        .filter(Boolean)
        .join(" / ")
    : "Team 2";

  const tournamentName = matchMeta?.tournament_name ?? "";
  const matchType = matchMeta?.match_type?.replace("_", " ") ?? "";
  const isLive = state.status === "Live";
  const isUpcoming = state.status === "Upcoming" || !state.status;

  const isTeam1Serving =
    state.serverId &&
    (state.serverId === matchMeta?.player1_team1_detail?.id ||
      state.serverId === matchMeta?.player2_team1_detail?.id);

  // ── Loading / error ──────────────────────────────────────────────────────────
  if (bootstrapError) {
    return (
      <FullScreenMessage
        text={bootstrapError}
        sub="Check admin panel for active matches."
      />
    );
  }

  if (!matchMeta) {
    return <FullScreenMessage text="LOADING MATCH…" pulse />;
  }

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* ── Background court lines ── */}
      <div style={S.courtLines} aria-hidden="true">
        <div style={S.courtLine1} />
        <div style={S.courtLine2} />
        <div style={S.courtCenter} />
      </div>

      {/* ── Score flash overlay ── */}
      {flashTeam && (
        <div
          style={{
            ...S.flashOverlay,
            background:
              flashTeam === 1
                ? "rgba(232,255,71,0.07)"
                : "rgba(71,180,255,0.07)",
          }}
          className="flash-in"
        />
      )}

      {/* ── Game won overlay ── */}
      {gameWonOverlay && (
        <div style={S.overlay} className="overlay-in">
          <div style={S.overlayInner}>
            <div style={S.overlayEyebrow}>GAME {gameWonOverlay.game}</div>
            <div style={S.overlayTitle}>GAME OVER</div>
          </div>
        </div>
      )}

      {/* ── Match won overlay ── */}
      {matchWonOverlay && (
        <div
          style={{ ...S.overlay, background: "rgba(12,15,12,0.97)" }}
          className="overlay-in"
        >
          <div style={S.overlayInner}>
            <div style={S.overlayEyebrow}>MATCH WINNER</div>
            <div
              style={{ ...S.overlayTitle, fontSize: "clamp(48px, 8vw, 96px)" }}
            >
              {matchWonOverlay.winner === 1 ? team1Name : team2Name}
            </div>
            <div style={S.overlayTrophy}>🏆</div>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <header style={S.topBar}>
        <div style={S.tournamentBlock}>
          <span style={S.tournamentName}>{tournamentName}</span>
          <span style={S.matchTypePill}>{matchType}</span>
        </div>

        <div style={S.statusBlock}>
          {isLive && (
            <span style={S.liveBadge}>
              <Dot
                className="live-dot"
                style={{ width: 28, height: 28, color: "#ff4444" }}
              />
              LIVE
            </span>
          )}
          {isUpcoming && <span style={S.upcomingBadge}>UPCOMING</span>}
          {state.status === "Completed" && (
            <span style={S.completedBadge}>COMPLETED</span>
          )}
          {/* Connection dot */}
          <span
            style={{
              ...S.connDot,
              background: isConnected ? "#22c55e" : "#f59e0b",
            }}
            title={isConnected ? "Live" : "Reconnecting…"}
          />
        </div>
      </header>

      {/* ── Main scoreboard ── */}
      <main style={S.main}>
        {/* Team 1 */}
        <div style={S.teamBlock}>
          <PlayerCard
            player={matchMeta.player1_team1_detail}
            secondaryPlayer={matchMeta.player2_team1_detail}
            isServing={isTeam1Serving}
          />
          <div style={S.teamNameDisplay}>{team1Name}</div>
        </div>

        {/* Centre score ── */}
        <div style={S.centreBlock}>
          {/* Set dots */}
          <div style={S.setDotsRow}>
            <SetDots count={state.team1Sets} />
            <span style={S.setLabel}>SETS</span>
            <SetDots count={state.team2Sets} />
          </div>

          {/* Big scores */}
          <div style={S.scoresRow}>
            <div
              style={{
                ...S.bigScore,
                color: flashTeam === 1 ? "#e8ff47" : "#fff",
                textShadow:
                  flashTeam === 1
                    ? "0 0 60px rgba(232,255,71,0.6)"
                    : "0 0 30px rgba(255,255,255,0.1)",
                transform: flashTeam === 1 ? "scale(1.05)" : "scale(1)",
              }}
              className="score-digit"
            >
              {state.team1Score}
            </div>

            <div style={S.scoreSep}>
              <span style={S.gameLabel}>GAME {state.currentGame}</span>
              <span style={S.dash}>–</span>
            </div>

            <div
              style={{
                ...S.bigScore,
                color: flashTeam === 2 ? "#71d4ff" : "#fff",
                textShadow:
                  flashTeam === 2
                    ? "0 0 60px rgba(71,212,255,0.6)"
                    : "0 0 30px rgba(255,255,255,0.1)",
                transform: flashTeam === 2 ? "scale(1.05)" : "scale(1)",
              }}
              className="score-digit"
            >
              {state.team2Score}
            </div>
          </div>

          {/* Game history pills */}
          {state.gameScores.length > 0 && (
            <div style={S.gameHistoryRow}>
              {state.gameScores.map((gs) => (
                <span key={gs.game_number} style={S.gameHistoryPill}>
                  G{gs.game_number} &nbsp; {gs.team1_score} – {gs.team2_score}
                </span>
              ))}
            </div>
          )}

          {/* Upcoming countdown */}
          {isUpcoming && matchMeta?.scheduled_time && (
            <CountdownTimer scheduledTime={matchMeta.scheduled_time} />
          )}
        </div>

        {/* Team 2 */}
        <div style={{ ...S.teamBlock, alignItems: "flex-end" }}>
          <PlayerCard
            player={matchMeta.player1_team2_detail}
            secondaryPlayer={matchMeta.player2_team2_detail}
            isServing={!isTeam1Serving && !!state.serverId}
          />
          <div style={{ ...S.teamNameDisplay, textAlign: "right" }}>
            {team2Name}
          </div>
        </div>
      </main>

      {/* ── Sponsors strip ── */}
      {sponsors.length > 0 && (
        <footer style={S.sponsorBar}>
          <span style={S.sponsorLabel}>SUPPORTED BY</span>
          <div style={S.sponsorSlot}>
            {sponsors.map((sp, i) => (
              <div
                key={sp.name}
                style={{
                  ...S.sponsorItem,
                  opacity: i === sponsorIndex ? 1 : 0,
                  transform:
                    i === sponsorIndex ? "translateY(0)" : "translateY(8px)",
                }}
              >
                <SponsorDisplay
                  sponsor={{ ...sp, logo_url: sp.logo_url || sp.logo }}
                />
              </div>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SetDots({ count }) {
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      {[0, 1].map((i) => (
        <span
          key={i}
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: i < count ? "#e8ff47" : "rgba(255,255,255,0.12)",
            boxShadow: i < count ? "0 0 12px rgba(232,255,71,0.5)" : "none",
            transition: "all 0.3s ease",
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

function CountdownTimer({ scheduledTime }) {
  const [timeLeft, setTimeLeft] = useState(calcTimeLeft(scheduledTime));

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(calcTimeLeft(scheduledTime)), 1000);
    return () => clearInterval(t);
  }, [scheduledTime]);

  if (!timeLeft) return null;

  return (
    <div style={S.countdown}>
      <span style={S.countdownLabel}>STARTS IN</span>
      <span style={S.countdownTime}>
        {String(timeLeft.minutes).padStart(2, "0")}
        <span style={S.countdownColon}>:</span>
        {String(timeLeft.seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

function calcTimeLeft(scheduledTime) {
  const diff = new Date(scheduledTime).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    minutes: Math.floor(diff / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

function FullScreenMessage({ text, sub, pulse }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0c0f0c",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Bebas Neue', cursive",
        gap: "16px",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');`}</style>
      <div
        style={{
          fontSize: "clamp(32px, 5vw, 64px)",
          color: "#fff",
          letterSpacing: "6px",
          animation: pulse ? "pulse 2s ease-in-out infinite" : "none",
        }}
      >
        {text}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "16px",
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "2px",
          }}
        >
          {sub}
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
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
    overflow: "hidden",
    position: "relative",
  },

  // Decorative court line geometry
  courtLines: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
    overflow: "hidden",
  },
  courtLine1: {
    position: "absolute",
    top: "10%",
    bottom: "10%",
    left: "50%",
    width: "1px",
    background: "rgba(255,255,255,0.04)",
    transform: "translateX(-50%)",
  },
  courtLine2: {
    position: "absolute",
    left: "10%",
    right: "10%",
    top: "50%",
    height: "1px",
    background: "rgba(255,255,255,0.04)",
    transform: "translateY(-50%)",
  },
  courtCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "120px",
    height: "120px",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
  },

  flashOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 5,
    pointerEvents: "none",
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(12,15,12,0.88)",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backdropFilter: "blur(4px)",
  },
  overlayInner: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  overlayEyebrow: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "clamp(14px, 2vw, 20px)",
    fontWeight: "700",
    letterSpacing: "6px",
    color: "rgba(255,255,255,0.4)",
  },
  overlayTitle: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(64px, 12vw, 140px)",
    letterSpacing: "8px",
    color: "#e8ff47",
    lineHeight: 1,
    textShadow: "0 0 80px rgba(232,255,71,0.4)",
  },
  overlayTrophy: {
    fontSize: "clamp(48px, 8vw, 80px)",
    marginTop: "12px",
    animation: "trophy-bounce 0.6s ease infinite alternate",
  },

  topBar: {
    position: "relative",
    zIndex: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "clamp(12px, 2vh, 24px) clamp(16px, 3vw, 48px)",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  tournamentBlock: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  tournamentName: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(18px, 2.5vw, 32px)",
    letterSpacing: "4px",
    color: "#fff",
  },
  matchTypePill: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "20px",
    padding: "4px 14px",
    fontSize: "clamp(10px, 1vw, 13px)",
    fontWeight: "600",
    letterSpacing: "1.5px",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
  },
  statusBlock: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    background: "rgba(255,68,68,0.15)",
    border: "1px solid rgba(255,68,68,0.3)",
    borderRadius: "20px",
    padding: "4px 14px 4px 6px",
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(14px, 1.5vw, 20px)",
    letterSpacing: "3px",
    color: "#ff6b6b",
  },
  upcomingBadge: {
    background: "rgba(245,158,11,0.15)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: "20px",
    padding: "4px 14px",
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(14px, 1.5vw, 20px)",
    letterSpacing: "3px",
    color: "#f59e0b",
  },
  completedBadge: {
    background: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "20px",
    padding: "4px 14px",
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(14px, 1.5vw, 20px)",
    letterSpacing: "3px",
    color: "#94a3b8",
  },
  connDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
    transition: "background 0.5s ease",
  },

  main: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "clamp(8px, 2vw, 32px)",
    padding: "clamp(16px, 3vh, 48px) clamp(16px, 3vw, 64px)",
  },

  teamBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
  },
  teamNameDisplay: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(18px, 2.5vw, 36px)",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 1.2,
  },

  centreBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "clamp(8px, 1.5vh, 20px)",
  },
  setDotsRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  setLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "clamp(10px, 1vw, 13px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.25)",
  },
  scoresRow: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(8px, 2vw, 32px)",
  },
  bigScore: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(80px, 14vw, 180px)",
    lineHeight: 1,
    transition: "color 0.4s ease, transform 0.15s ease, text-shadow 0.4s ease",
    minWidth: "1.2ch",
    textAlign: "center",
  },
  scoreSep: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  gameLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "clamp(9px, 0.9vw, 12px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.25)",
  },
  dash: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(32px, 5vw, 60px)",
    color: "rgba(255,255,255,0.15)",
    lineHeight: 1,
  },

  gameHistoryRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  gameHistoryPill: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "4px 14px",
    fontSize: "clamp(11px, 1vw, 14px)",
    color: "rgba(255,255,255,0.35)",
    fontFamily: "'DM Mono', monospace",
    letterSpacing: "1px",
  },

  countdown: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    marginTop: "8px",
  },
  countdownLabel: {
    fontSize: "clamp(10px, 1vw, 13px)",
    fontWeight: "700",
    letterSpacing: "4px",
    color: "rgba(255,255,255,0.3)",
  },
  countdownTime: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(36px, 5vw, 64px)",
    color: "#f59e0b",
    letterSpacing: "4px",
    lineHeight: 1,
  },
  countdownColon: {
    animation: "blink 1s step-end infinite",
    margin: "0 2px",
  },

  sponsorBar: {
    position: "relative",
    zIndex: 10,
    borderTop: "1px solid rgba(255,255,255,0.05)",
    padding: "clamp(10px, 1.5vh, 20px) clamp(16px, 3vw, 48px)",
    display: "flex",
    alignItems: "center",
    gap: "24px",
  },
  sponsorLabel: {
    fontSize: "clamp(9px, 0.8vw, 11px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.2)",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  sponsorSlot: {
    position: "relative",
    height: "50px",
    flex: 1,
  },
  sponsorItem: {
    position: "absolute",
    top: 0,
    left: 0,
    transition: "opacity 0.8s ease, transform 0.8s ease",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&family=DM+Mono&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0c0f0c; overflow: hidden; }
  #root { height: 100dvh; }

  .live-dot {
    animation: live-pulse 1.2s ease-in-out infinite;
  }
  @keyframes live-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  .score-digit {
    transition: color 0.4s ease, transform 0.15s cubic-bezier(0.34,1.56,0.64,1), text-shadow 0.4s ease;
  }

  .flash-in {
    animation: flash-fade 0.7s ease-out both;
  }
  @keyframes flash-fade {
    0%   { opacity: 1; }
    100% { opacity: 0; }
  }

  .overlay-in {
    animation: overlay-appear 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }
  @keyframes overlay-appear {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  @keyframes trophy-bounce {
    from { transform: translateY(0); }
    to   { transform: translateY(-12px); }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
`;
