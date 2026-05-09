// src/pages/CourtScreen.jsx
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES (court-based auto-switching scoreboard)
//   URL:  /screen/court/:slug
//   1. Resolves court from slug  → GET /api/courts/by_slug/?slug=<slug>
//   2. Polls /api/courts/<id>/matches/?status=Live  every 30 s
//   3. Connects WebSocket for live score updates via useMatchSocket
//   4. Auto-switches when match changes / ends (re-polls after 5 s)
//   5. Shows idle screen when no live match is on this court
//
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO APPLY THIS TO App.jsx
//   This file IS the new App.jsx logic + all sponsor/layout improvements.
//   To migrate App.jsx, do the following:
//
//   1. Replace the SponsorDisplay import line:
//        BEFORE: import SponsorDisplay from "./components/SponsorDisplay";
//        AFTER:  import SponsorDisplay, { getTier } from "./components/SponsorDisplay";
//
//   2. Remove the useParams import (not needed in App.jsx)
//      and remove the court-resolution logic (steps 1 & 2 below the comment
//      "── 1. Resolve court by slug" and "── 2. Poll for live match").
//      App.jsx keeps its own bootstrap fetch instead.
//
//   3. Copy the sponsor tier bucket variables (search "SPONSOR TIER BUCKETS")
//      into App.jsx right after the existing sponsors state.
//
//   4. Replace the carousel useEffect in App.jsx with the one marked
//      "CAROUSEL USEEFFECT".
//
//   5. Replace the entire <header> JSX block with the one marked
//      "TOP BAR JSX — 3-column grid".
//
//   6. Replace the entire <footer> JSX block with the one marked
//      "SPONSOR FOOTER JSX".
//
//   7. Replace the match-won overlay JSX with the one marked
//      "MATCH WON OVERLAY JSX" (adds "PRESENTED BY" title sponsor).
//
//   8. Replace S.main padding, S.topBar, S.tournamentBlock, S.statusBlock,
//      and all sponsor styles with the ones at the bottom of this file
//      (marked "── Styles").
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom"; // REMOVE THIS LINE in App.jsx
import { Dot } from "lucide-react";
import PlayerCard from "../components/PlayerCard"; // App.jsx: "./components/PlayerCard"
import SponsorDisplay, { getTier } from "../components/SponsorDisplay"; // App.jsx: "./components/SponsorDisplay"
import { useMatchSocket } from "../hooks/useMatchSocket"; // App.jsx: "./hooks/useMatchSocket"

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const POLL_INTERVAL = 30_000; // 30 seconds between live-match polls

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (copy all of these into App.jsx as-is)
// ─────────────────────────────────────────────────────────────────────────────

// ── SetDots ───────────────────────────────────────────────────────────────────
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
            boxShadow: i < count ? "0 0 10px rgba(232,255,71,0.5)" : "none",
            transition: "background 0.4s ease, box-shadow 0.4s ease",
            display: "inline-block",
          }}
        />
      ))}
    </div>
  );
}

// ── CountdownTimer ────────────────────────────────────────────────────────────
function CountdownTimer({ scheduledTime }) {
  const calc = () => {
    const diff = new Date(scheduledTime) - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    const s = Math.floor((diff % 60_000) / 1_000);
    return { h, m, s };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, [scheduledTime]);
  if (!t) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return (
    <div style={S.countdown}>
      <span style={S.countdownLabel}>STARTS IN</span>
      <span style={S.countdownTime}>
        {t.h > 0 && (
          <>
            {pad(t.h)}
            <span style={S.countdownColon}>:</span>
          </>
        )}
        {pad(t.m)}
        <span style={S.countdownColon}>:</span>
        {pad(t.s)}
      </span>
    </div>
  );
}

// ── FullScreenMessage ─────────────────────────────────────────────────────────
function FullScreenMessage({ text, sub, pulse }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0c0f0c",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        fontFamily: "'DM Sans',sans-serif",
      }}
    >
      <div
        style={{
          fontSize: "clamp(20px,4vw,48px)",
          letterSpacing: "6px",
          fontWeight: "700",
          color: "#e8ff47",
          animation: pulse ? "pulse 2s ease-in-out infinite" : "none",
          textAlign: "center",
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
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── IdleScreen (CourtScreen only — not needed in App.jsx) ────────────────────
function IdleScreen({ courtName, venueName, nextMatch }) {
  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.courtLines} aria-hidden="true">
        <div style={S.courtLine1} />
        <div style={S.courtLine2} />
        <div style={S.courtCenter} />
      </div>
      {/* Court identity badge */}
      <div style={S.courtBadge}>
        <span style={S.courtBadgeVenue}>{venueName}</span>
        <span style={S.courtBadgeName}>{courtName}</span>
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: "clamp(48px,10vw,100px)",
            animation: "shuttleFloat 3s ease-in-out infinite",
          }}
        >
          🏸
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue',cursive",
            fontSize: "clamp(20px,3vw,40px)",
            color: "rgba(255,255,255,0.2)",
            letterSpacing: 6,
          }}
        >
          Waiting for match
        </div>
        {/* Up-next card shown when an upcoming match exists on this court */}
        {nextMatch && (
          <div
            style={{
              marginTop: 16,
              background: "rgba(232,255,71,0.06)",
              border: "1px solid rgba(232,255,71,0.15)",
              borderRadius: 20,
              padding: "24px 48px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: "clamp(10px,1vw,13px)",
                fontWeight: 700,
                letterSpacing: 4,
                color: "rgba(255,255,255,0.25)",
                marginBottom: 14,
              }}
            >
              UP NEXT
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue',cursive",
                fontSize: "clamp(24px,4vw,52px)",
                color: "#fff",
                letterSpacing: 3,
              }}
            >
              {nextMatch.team1}{" "}
              <span style={{ color: "rgba(255,255,255,0.2)" }}>–</span>{" "}
              {nextMatch.team2}
            </div>
            {nextMatch.scheduled_time && (
              <CountdownTimer scheduledTime={nextMatch.scheduled_time} />
            )}
          </div>
        )}
      </div>
      {/* Tiny green pulse dot — reassures staff the screen is alive */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "rgba(232,255,71,0.2)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function CourtScreen() {
  // ── Court slug from URL (CourtScreen only — remove in App.jsx) ────────────
  const { slug } = useParams();

  // ── State ─────────────────────────────────────────────────────────────────
  // Court resolution (CourtScreen only)
  const [court, setCourt] = useState(null);
  const [courtError, setCourtError] = useState(null);
  const [courtLoading, setCourtLoading] = useState(true);

  // Match data
  const [matchId, setMatchId] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null); // static detail from REST
  const [nextMatch, setNextMatch] = useState(null); // upcoming match for idle screen
  const [sponsors, setSponsors] = useState([]);

  // Scoreboard UI
  const [flashTeam, setFlashTeam] = useState(null); // 1 | 2
  const [gameWonOverlay, setGameWonOverlay] = useState(null);
  const [matchWonOverlay, setMatchWonOverlay] = useState(null);
  const [sponsorIndex, setSponsorIndex] = useState(0);

  const prevScores = useRef({ t1: null, t2: null });
  const prevMatchWon = useRef(false);

  // ─────────────────────────────────────────────────────────────────────────
  // SPONSOR TIER BUCKETS
  // Copy these 4 lines into App.jsx right after "const [sponsorIndex, ...]"
  // ─────────────────────────────────────────────────────────────────────────
  const titleSponsors = sponsors.filter((s) => getTier(s.priority) === "title");
  const goldSponsors = sponsors.filter((s) => getTier(s.priority) === "gold");
  const standardSponsors = sponsors.filter(
    (s) => getTier(s.priority) === "standard",
  );
  // Gold + standard share the right-side carousel slot
  const carouselSponsors = [...goldSponsors, ...standardSponsors];

  // ── 1. Resolve court by slug (CourtScreen only — remove block in App.jsx) ─
  useEffect(() => {
    if (!slug) return;
    setCourtLoading(true);
    fetch(`${API_BASE}/courts/by_slug/?slug=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Court "${slug}" not found`);
        return r.json();
      })
      .then((d) => {
        setCourt(d);
        setCourtLoading(false);
      })
      .catch((e) => {
        setCourtError(e.message);
        setCourtLoading(false);
      });
  }, [slug]);

  // ── 2. Poll for live match on this court (CourtScreen only) ──────────────
  const pollForMatch = useCallback(async () => {
    if (!court) return;
    try {
      // Try live first
      const liveRes = await fetch(
        `${API_BASE}/courts/${court.id}/matches/?status=Live`,
      );
      const liveArr = await liveRes
        .json()
        .then((d) => (Array.isArray(d) ? d : (d.results ?? [])));

      if (liveArr.length > 0) {
        const m = liveArr[0];
        setMatchId((prev) => (prev === m.id ? prev : m.id)); // avoid unnecessary re-renders
        setNextMatch(null);
        return;
      }

      // No live match — clear and look for upcoming to show in idle screen
      setMatchId(null);
      setMatchMeta(null);

      const upRes = await fetch(
        `${API_BASE}/courts/${court.id}/matches/?status=Upcoming`,
      );
      const up = await upRes
        .json()
        .then((d) => (Array.isArray(d) ? d : (d.results ?? [])));

      if (up.length > 0) {
        const u = up[0];
        const t1 = [u.player1_team1_name, u.player2_team1_name]
          .filter(Boolean)
          .join(" / ");
        const t2 = [u.player1_team2_name, u.player2_team2_name]
          .filter(Boolean)
          .join(" / ");
        setNextMatch({
          team1: t1,
          team2: t2,
          scheduled_time: u.scheduled_time,
        });
      } else {
        setNextMatch(null);
      }
    } catch (e) {
      console.error("[CourtScreen] poll error:", e);
    }
  }, [court]);

  useEffect(() => {
    if (!court) return;
    pollForMatch();
    const t = setInterval(pollForMatch, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [court, pollForMatch]);

  // ── 3. Fetch match metadata when matchId changes ──────────────────────────
  // In App.jsx this is already done in the bootstrap() function.
  // Only copy this block if App.jsx doesn't already fetch match detail + sponsors.
  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const detail = await fetch(`${API_BASE}/matches/${matchId}/`).then(
          (r) => r.json(),
        );
        if (cancelled) return;
        setMatchMeta(detail);

        const sData = await fetch(
          `${API_BASE}/sponsors/?tournament=${detail.tournament}`,
        ).then((r) => r.json());
        if (cancelled) return;
        setSponsors(Array.isArray(sData) ? sData : (sData.results ?? []));
      } catch (e) {
        console.error("[CourtScreen] meta error:", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // ── 4. Live score via WebSocket ───────────────────────────────────────────
  const { state, isConnected } = useMatchSocket(matchId);

  // Auto re-poll 5 s after match completes so the screen transitions to idle
  useEffect(() => {
    if (state.matchWon && !prevMatchWon.current) setTimeout(pollForMatch, 5000);
    prevMatchWon.current = state.matchWon;
  }, [state.matchWon, pollForMatch]);

  // ── 5. Score flash ────────────────────────────────────────────────────────
  useEffect(() => {
    const { t1, t2 } = prevScores.current;
    if (t1 === null) {
      prevScores.current = { t1: state.team1Score, t2: state.team2Score };
      return;
    }
    if (state.team1Score !== t1) {
      setFlashTeam(1);
      setTimeout(() => setFlashTeam(null), 700);
    } else if (state.team2Score !== t2) {
      setFlashTeam(2);
      setTimeout(() => setFlashTeam(null), 700);
    }
    prevScores.current = { t1: state.team1Score, t2: state.team2Score };
  }, [state.team1Score, state.team2Score]);

  // ── 6. Game won / match won overlays ──────────────────────────────────────
  useEffect(() => {
    if (state.gameWon && !state.matchWon) {
      setGameWonOverlay({ game: state.currentGame - 1 });
      const t = setTimeout(() => setGameWonOverlay(null), 3500);
      return () => clearTimeout(t);
    }
  }, [state.gameWon, state.currentGame]);

  useEffect(() => {
    if (state.matchWon) setMatchWonOverlay({ winner: state.winner });
  }, [state.matchWon, state.winner]);

  // ─────────────────────────────────────────────────────────────────────────
  // CAROUSEL USEEFFECT
  // Replace the existing sponsor carousel useEffect in App.jsx with this.
  // Key change: cycles through carouselSponsors (gold + standard) in groups
  // of 4, not one at a time. Title sponsor is always visible — never cycles.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (carouselSponsors.length <= 4) return; // all fit on screen — no cycling needed
    const t = setInterval(() => {
      setSponsorIndex((i) => (i + 1) % carouselSponsors.length);
    }, 4000);
    return () => clearInterval(t);
  }, [carouselSponsors.length]);

  // ── Guards (CourtScreen only) ─────────────────────────────────────────────
  if (courtLoading) return <FullScreenMessage text="LOADING…" pulse />;
  if (courtError)
    return <FullScreenMessage text="COURT NOT FOUND" sub={courtError} />;
  if (!matchId || !matchMeta) {
    return (
      <IdleScreen
        courtName={court.name}
        venueName={court.venue_name}
        nextMatch={nextMatch}
      />
    );
  }

  // ── Derived display values ────────────────────────────────────────────────
  const p = matchMeta;
  const team1Name =
    [
      p.player1_team1_detail?.name ?? p.player1_team1?.name,
      p.player2_team1_detail?.name ?? p.player2_team1?.name,
    ]
      .filter(Boolean)
      .join(" / ") || "Team 1";

  const team2Name =
    [
      p.player1_team2_detail?.name ?? p.player1_team2?.name,
      p.player2_team2_detail?.name ?? p.player2_team2?.name,
    ]
      .filter(Boolean)
      .join(" / ") || "Team 2";

  const tournamentName = p.tournament_name ?? "";
  const matchType = p.match_type ?? "";
  const eventName = p.event_name ?? ""; // shown as breadcrumb pill

  const isLive = state.status === "Live" || p.status === "Live";
  const isUpcoming = state.status === "Upcoming" || p.status === "Upcoming";

  const isTeam1Serving =
    state.serverId &&
    (state.serverId === (p.player1_team1_detail?.id ?? p.player1_team1?.id) ||
      state.serverId === (p.player2_team1_detail?.id ?? p.player2_team1?.id));

  // ── Visible carousel slice (up to 4 sponsors shown at once) ──────────────
  const visibleCarouselIndices = [0, 1, 2, 3].map(
    (offset) => (sponsorIndex + offset) % (carouselSponsors.length || 1),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Court identity badge — top-left corner (CourtScreen only) */}
      <div style={S.courtBadge}>
        <span style={S.courtBadgeVenue}>{court.venue_name}</span>
        <span style={S.courtBadgeName}>{court.name}</span>
      </div>

      {/* Decorative court lines */}
      <div style={S.courtLines} aria-hidden="true">
        <div style={S.courtLine1} />
        <div style={S.courtLine2} />
        <div style={S.courtCenter} />
      </div>

      {/* Score flash full-screen tint */}
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

      {/* Game won overlay */}
      {gameWonOverlay && (
        <div style={S.overlay} className="overlay-in">
          <div style={S.overlayInner}>
            <div style={S.overlayEyebrow}>GAME {gameWonOverlay.game}</div>
            <div style={S.overlayTitle}>GAME OVER</div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          MATCH WON OVERLAY JSX
          Replace the match-won overlay in App.jsx with this block.
          Key addition: "PRESENTED BY" title sponsor logo below the trophy.
          ───────────────────────────────────────────────────────────────── */}
      {matchWonOverlay && (
        <div
          style={{ ...S.overlay, background: "rgba(12,15,12,0.97)" }}
          className="overlay-in"
        >
          <div style={S.overlayInner}>
            <div style={S.overlayEyebrow}>MATCH WINNER</div>
            <div
              style={{ ...S.overlayTitle, fontSize: "clamp(48px,8vw,96px)" }}
            >
              {matchWonOverlay.winner === 1 ? team1Name : team2Name}
            </div>
            <div style={S.overlayTrophy}>🏆</div>

            {/* Title sponsor "PRESENTED BY" moment — highest-value eyeball time */}
            {titleSponsors.length > 0 && (
              <div style={S.overlayPresentedBy}>
                <div style={S.overlayPresentedByLabel}>PRESENTED BY</div>
                <SponsorDisplay sponsor={titleSponsors[0]} tier="title" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          TOP BAR JSX — 3-column grid
          Replace the entire <header> in App.jsx with this block.
          Changes vs old version:
            • display:grid / gridTemplateColumns:"1fr auto 1fr"  (3 columns)
            • Empty <div/> in col-1 keeps centre column truly centred
            • Tournament name uses Bebas Neue + larger size
            • Breadcrumb pill: eventName › matchType (matchType always shown)
            • statusBlock uses justifyContent:"flex-end" to hug the right edge
          ───────────────────────────────────────────────────────────────── */}
      <header style={S.topBar}>
        {/* Col 1 — intentionally empty (balances the status block on the right) */}
        <div />

        {/* Col 2 — tournament name + event/match-type pills — TRUE CENTRE */}
        <div style={S.tournamentBlock}>
          <span style={S.tournamentName}>{tournamentName}</span>
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Breadcrumb: show eventName › matchType when event exists,
                otherwise just matchType pill alone */}
            {eventName ? (
              <>
                {/* Yellow pill for event category */}
                <span
                  style={{
                    ...S.matchTypePill,
                    background: "rgba(232,255,71,0.12)",
                    color: "#e8ff47",
                    border: "1px solid rgba(232,255,71,0.25)",
                  }}
                >
                  {eventName}
                </span>
                {/* Arrow separator */}
                <span
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ›
                </span>
                {/* Grey pill for match format */}
                <span style={S.matchTypePill}>{matchType}</span>
              </>
            ) : (
              /* No event assigned — just show match type */
              <span style={S.matchTypePill}>{matchType}</span>
            )}
          </div>
        </div>

        {/* Col 3 — live badge + connection dot — pushed to right edge */}
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
          {/* Green = WS connected, amber = reconnecting */}
          <span
            style={{
              ...S.connDot,
              background: isConnected ? "#22c55e" : "#f59e0b",
            }}
            title={isConnected ? "Live" : "Reconnecting…"}
          />
        </div>
      </header>

      {/* Main scoreboard — 3-column grid: team | score | team */}
      <main style={S.main}>
        {/* Team 1 — left side */}
        <div style={S.teamBlock}>
          <PlayerCard
            player={p.player1_team1_detail}
            secondaryPlayer={p.player2_team1_detail}
            isServing={isTeam1Serving}
          />
          <div style={S.teamNameDisplay}>{team1Name}</div>
        </div>

        {/* Centre score block */}
        <div style={S.centreBlock}>
          {/* Set dots: ● ● SETS ● ● */}
          <div style={S.setDotsRow}>
            <SetDots count={state.team1Sets} />
            <span style={S.setLabel}>SETS</span>
            <SetDots count={state.team2Sets} />
          </div>

          {/* Giant scores */}
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

          {/* Completed game history pills — G1 21–18, G2 18–21, etc. */}
          {state.gameScores.length > 0 && (
            <div style={S.gameHistoryRow}>
              {state.gameScores.map((gs) => (
                <span key={gs.game_number} style={S.gameHistoryPill}>
                  G{gs.game_number}&nbsp;&nbsp;{gs.team1_score} –{" "}
                  {gs.team2_score}
                </span>
              ))}
            </div>
          )}

          {/* Countdown shown when match is still upcoming */}
          {isUpcoming && p?.scheduled_time && (
            <CountdownTimer scheduledTime={p.scheduled_time} />
          )}
        </div>

        {/* Team 2 — right side (mirror: aligned to flex-end) */}
        <div style={{ ...S.teamBlock, alignItems: "flex-end" }}>
          <PlayerCard
            player={p.player1_team2_detail}
            secondaryPlayer={p.player2_team2_detail}
            isServing={!isTeam1Serving && !!state.serverId}
          />
          <div style={{ ...S.teamNameDisplay, textAlign: "right" }}>
            {team2Name}
          </div>
        </div>
      </main>

      {/* ─────────────────────────────────────────────────────────────────────
          SPONSOR FOOTER JSX
          Replace the entire <footer> in App.jsx with this block.
          Layout:
            [TITLE SPONSOR — always visible] | "ALSO SUPPORTED BY" (rotated)
            | [gold/standard carousel — up to 4 at once] | [progress dots]
          ───────────────────────────────────────────────────────────────── */}
      {sponsors.length > 0 && (
        <footer style={S.sponsorBar}>
          {/* Title sponsor — always anchored left, never cycles */}
          {titleSponsors.length > 0 && (
            <div style={S.titleSlot}>
              <SponsorDisplay sponsor={titleSponsors[0]} tier="title" />
            </div>
          )}

          {/* Vertical divider between title and the rest */}
          {titleSponsors.length > 0 && carouselSponsors.length > 0 && (
            <div style={S.sponsorDivider} />
          )}

          {/* Rotated label — "ALSO SUPPORTED BY" or "SUPPORTED BY" */}
          {carouselSponsors.length > 0 && (
            <span style={S.sponsorLabel}>
              {titleSponsors.length > 0 ? "ALSO SUPPORTED BY" : "SUPPORTED BY"}
            </span>
          )}

          {/* Gold + standard sponsors — show all if ≤4, else carousel */}
          {carouselSponsors.length > 0 && (
            <div style={S.sponsorRow}>
              {carouselSponsors.length <= 4
                ? /* All fit on screen — show every one simultaneously */
                  carouselSponsors.map((sp) => (
                    <div key={sp.id ?? sp.name} style={S.sponsorCell}>
                      <SponsorDisplay sponsor={sp} />
                    </div>
                  ))
                : /* Too many to show at once — fade-cycle groups of 4 */
                  carouselSponsors.map((sp, i) => {
                    const isVisible = visibleCarouselIndices.includes(i);
                    const slot = visibleCarouselIndices.indexOf(i); // 0-3
                    return (
                      <div
                        key={sp.id ?? sp.name}
                        style={{
                          ...S.sponsorCell,
                          opacity: isVisible ? 1 : 0,
                          transform: isVisible
                            ? "translateY(0)"
                            : "translateY(6px)",
                          transition: "opacity 0.8s ease, transform 0.8s ease",
                          pointerEvents: isVisible ? "auto" : "none",
                          position: "absolute",
                          left: `${slot * 25}%`,
                        }}
                      >
                        <SponsorDisplay sponsor={sp} />
                      </div>
                    );
                  })}
            </div>
          )}

          {/* Progress dots — only shown when there are more sponsors than fit */}
          {carouselSponsors.length > 4 && (
            <div style={S.progressDots}>
              {carouselSponsors.map((_, i) => (
                <span
                  key={i}
                  style={{
                    ...S.progressDot,
                    background:
                      i === sponsorIndex
                        ? "rgba(255,255,255,0.6)"
                        : "rgba(255,255,255,0.15)",
                    transform: i === sponsorIndex ? "scaleX(2.5)" : "scaleX(1)",
                  }}
                />
              ))}
            </div>
          )}
        </footer>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// Replace the entire S = { ... } object in App.jsx with this.
// Changes vs old version:
//   • topBar          → display:grid, gridTemplateColumns:"1fr auto 1fr"
//   • tournamentBlock → column flex, text-align:center
//   • tournamentName  → Bebas Neue, larger clamp, full white
//   • statusBlock     → justifyContent:"flex-end"
//   • main.padding    → wider horizontal padding (players off the edge fix)
//   • sponsorBar      → taller (minHeight 90px), backdrop blur, flex layout
//   • NEW: titleSlot, sponsorDivider, sponsorRow, sponsorCell, progressDots,
//          progressDot, overlayPresentedBy, overlayPresentedByLabel
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  // ── Page shell ─────────────────────────────────────────────────────────────
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

  // ── Court identity badge (CourtScreen only — remove from App.jsx) ───────
  courtBadge: {
    position: "absolute",
    top: 14,
    left: 20,
    display: "flex",
    flexDirection: "column",
    zIndex: 20,
    pointerEvents: "none",
  },
  courtBadgeVenue: {
    fontSize: "clamp(9px,1vw,12px)",
    color: "rgba(255,255,255,0.2)",
    textTransform: "uppercase",
    letterSpacing: 3,
    fontFamily: "'DM Sans',sans-serif",
  },
  courtBadgeName: {
    fontSize: "clamp(12px,1.4vw,17px)",
    color: "rgba(232,255,71,0.55)",
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontFamily: "'Bebas Neue',cursive",
  },

  // ── Decorative court lines ─────────────────────────────────────────────────
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
    transform: "translate(-50%,-50%)",
  },

  // ── Flash + overlays ───────────────────────────────────────────────────────
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
  },
  overlayInner: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  },
  overlayEyebrow: {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: "clamp(14px,1.5vw,20px)",
    fontWeight: "700",
    letterSpacing: "6px",
    color: "rgba(255,255,255,0.4)",
    marginBottom: "4px",
    textTransform: "uppercase",
  },
  overlayTitle: {
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(64px,12vw,160px)",
    color: "#e8ff47",
    letterSpacing: "6px",
    lineHeight: 1,
  },
  overlayTrophy: {
    fontSize: "clamp(48px,8vw,96px)",
    marginTop: "8px",
    animation: "trophy-bounce 0.6s ease-in-out alternate infinite",
  },
  // "PRESENTED BY" title sponsor block inside match-won overlay
  overlayPresentedBy: {
    marginTop: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  overlayPresentedByLabel: {
    fontSize: "clamp(9px,0.8vw,11px)",
    fontWeight: 800,
    letterSpacing: 4,
    color: "rgba(255,255,255,0.2)",
    fontFamily: "'DM Sans',sans-serif",
  },

  // ── TOP BAR — 3-column grid ────────────────────────────────────────────────
  // Col 1: empty  |  Col 2: tournament info (centred)  |  Col 3: status badges
  topBar: {
    position: "relative",
    zIndex: 10,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr", // true 3-column balance
    alignItems: "center",
    padding: "clamp(12px,2vh,24px) clamp(16px,3vw,48px)",
  },
  // Centre column: stacks tournament name above the pills
  tournamentBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
  // CHANGED: Bebas Neue + bigger — readable from 8 metres
  tournamentName: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(22px,3vw,42px)",
    letterSpacing: "4px",
    color: "#fff",
    lineHeight: 1,
  },
  // Event/match-type pill — grey by default, yellow variant applied inline for event
  matchTypePill: {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "20px",
    padding: "3px 14px",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: "clamp(10px,1vw,13px)",
    fontWeight: "700",
    letterSpacing: "2px",
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
  },
  // Right column: status badges flush to the right
  statusBlock: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    justifyContent: "flex-end", // CHANGED: was no justifyContent
  },
  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "rgba(255,68,68,0.1)",
    border: "1px solid rgba(255,68,68,0.25)",
    borderRadius: "20px",
    padding: "4px 14px 4px 6px",
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(14px,1.5vw,20px)",
    letterSpacing: "3px",
    color: "#ff6b6b",
  },
  upcomingBadge: {
    background: "rgba(245,158,11,0.15)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: "20px",
    padding: "4px 14px",
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(14px,1.5vw,20px)",
    letterSpacing: "3px",
    color: "#f59e0b",
  },
  completedBadge: {
    background: "rgba(148,163,184,0.1)",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: "20px",
    padding: "4px 14px",
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(14px,1.5vw,20px)",
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

  // ── MAIN SCOREBOARD — 3-column grid ───────────────────────────────────────
  main: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "clamp(8px,2vw,32px)",
    // CHANGED: bigger horizontal padding — players were too close to screen edge
    padding: "clamp(16px,3vh,48px) clamp(48px,7vw,120px)",
  },
  teamBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "12px",
  },
  teamNameDisplay: {
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(18px,2.5vw,36px)",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 1.2,
  },

  // ── Centre score block ─────────────────────────────────────────────────────
  centreBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "clamp(8px,1.5vh,20px)",
  },
  setDotsRow: { display: "flex", alignItems: "center", gap: "16px" },
  setLabel: {
    fontFamily: "'DM Sans',sans-serif",
    fontSize: "clamp(10px,1vw,13px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.25)",
  },
  scoresRow: {
    display: "flex",
    alignItems: "center",
    gap: "clamp(8px,2vw,32px)",
  },
  bigScore: {
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(80px,14vw,180px)",
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
    fontFamily: "'DM Sans',sans-serif",
    fontSize: "clamp(9px,0.9vw,12px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.25)",
  },
  dash: {
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(32px,5vw,60px)",
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
    fontSize: "clamp(11px,1vw,14px)",
    color: "rgba(255,255,255,0.35)",
    fontFamily: "'DM Mono',monospace",
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
    fontSize: "clamp(10px,1vw,13px)",
    fontWeight: "700",
    letterSpacing: "4px",
    color: "rgba(255,255,255,0.3)",
  },
  countdownTime: {
    fontFamily: "'Bebas Neue',cursive",
    fontSize: "clamp(36px,5vw,64px)",
    color: "#f59e0b",
    letterSpacing: "4px",
    lineHeight: 1,
  },
  countdownColon: { animation: "blink 1s step-end infinite", margin: "0 2px" },

  // ── SPONSOR BAR — tiered layout ────────────────────────────────────────────
  // CHANGED: taller bar, backdrop blur, flex with dedicated slots
  sponsorBar: {
    position: "relative",
    zIndex: 10,
    borderTop: "1px solid rgba(255,255,255,0.06)",
    padding: "clamp(10px,1.5vh,18px) clamp(16px,3vw,48px)",
    display: "flex",
    alignItems: "center",
    gap: "clamp(12px,2vw,28px)",
    background: "rgba(0,0,0,0.25)",
    backdropFilter: "blur(8px)",
    minHeight: "clamp(80px,10vh,100px)", // CHANGED: was ~50px, now 80-100px
  },
  // Title sponsor anchor — left side, never moves
  titleSlot: {
    flexShrink: 0,
  },
  // Thin vertical rule between title sponsor and the rest
  sponsorDivider: {
    width: 1,
    alignSelf: "stretch",
    background: "rgba(255,255,255,0.08)",
    flexShrink: 0,
    margin: "4px 0",
  },
  // CHANGED: rotated label (was horizontal, wastes width on wide screen)
  sponsorLabel: {
    fontSize: "clamp(8px,0.7vw,10px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.18)",
    whiteSpace: "nowrap",
    flexShrink: 0,
    fontFamily: "'DM Sans', sans-serif",
    writingMode: "vertical-rl", // rotated 90°
    transform: "rotate(180deg)", // flip so text reads top → bottom
  },
  // Flex row holding the gold + standard sponsor cards
  sponsorRow: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "clamp(8px,1.5vw,20px)",
    position: "relative",
    minHeight: 72, // enough room for gold-tier cards
  },
  sponsorCell: {
    flexShrink: 0,
  },
  // Vertical stack of dots (one per carousel sponsor) — right edge
  progressDots: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignSelf: "center",
    flexShrink: 0,
  },
  progressDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    transition: "background 0.4s ease, transform 0.4s ease",
    transformOrigin: "center",
    display: "inline-block",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CSS ANIMATIONS
// Replace the CSS template string in App.jsx with this.
// Addition: shuttleFloat (idle screen only — harmless to include in App.jsx)
// ─────────────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&family=DM+Mono&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #0c0f0c; overflow: hidden; }
  #root { height: 100dvh; }

  .live-dot    { animation: live-pulse 1.2s ease-in-out infinite; }
  .score-digit { transition: color 0.4s ease, transform 0.15s cubic-bezier(0.34,1.56,0.64,1), text-shadow 0.4s ease; }
  .flash-in    { animation: flash-fade 0.7s ease-out both; }
  .overlay-in  { animation: overlay-appear 0.35s cubic-bezier(0.16,1,0.3,1) both; }

  @keyframes live-pulse     { 0%,100%{opacity:1}    50%{opacity:0.3} }
  @keyframes flash-fade     { 0%{opacity:1}          100%{opacity:0} }
  @keyframes overlay-appear { from{opacity:0}        to{opacity:1} }
  @keyframes trophy-bounce  { from{transform:translateY(0)} to{transform:translateY(-12px)} }
  @keyframes blink          { 0%,100%{opacity:1}     50%{opacity:0} }
  @keyframes shuttleFloat   { 0%,100%{transform:translateY(0) rotate(-10deg)} 50%{transform:translateY(-18px) rotate(10deg)} }
`;
