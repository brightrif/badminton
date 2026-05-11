// src/pages/CourtScreen.jsx
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES (court-based auto-switching scoreboard)
//   URL:  /screen/court/:slug
//   1. Resolves court from slug  → GET /api/courts/by_slug/?slug=<slug>
//   2. Polls /api/courts/<id>/matches/?status=Live  every 30 s
//   3. Connects WebSocket for live score updates via useMatchSocket
//   4. Auto-switches when match changes / ends (re-polls after 60 s)
//   5. Shows idle screen when no live match is on this court
//
// SPONSOR FETCH PRIORITY (tournament-filtered):
//   1. Live match tournament      → most relevant
//   2. Upcoming match tournament  → next best
//   3. Most recent completed match tournament → fallback when nothing scheduled
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Dot } from "lucide-react";
import PlayerCard from "../components/PlayerCard";
import SponsorDisplay from "../components/SponsorDisplay";
import { getTier } from "../utils/sponsorTiers";
import { useMatchSocket } from "../hooks/useMatchSocket";
// New hook for court-level WebSocket (break mode)
import { useCourtSocket } from "../hooks/useCourtSocket";
import BreakScreen from "../components/BreakScreen";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const POLL_INTERVAL = 30_000; // 30 seconds between live-match polls

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
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

// ── IdleScreen ────────────────────────────────────────────────────────────────
function IdleScreen({
  courtName,
  venueName,
  nextMatch,
  sponsors = [],
  tournamentName = "",
}) {
  const [sponsorIndex, setSponsorIndex] = useState(0);

  const titleSponsors = sponsors.filter((s) => getTier(s.priority) === "title");
  const carouselSponsors = sponsors.filter(
    (s) => getTier(s.priority) !== "title",
  );

  useEffect(() => {
    if (carouselSponsors.length <= 1) return;
    const t = setInterval(() => {
      setSponsorIndex((i) => (i + 1) % carouselSponsors.length);
    }, 3000);
    return () => clearInterval(t);
  }, [carouselSponsors.length]);

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.courtLines} aria-hidden="true">
        <div style={S.courtLine1} />
        <div style={S.courtLine2} />
        <div style={S.courtCenter} />
      </div>

      {/* Court identity badge — top-left */}
      <div style={S.courtBadge}>
        <span style={S.courtBadgeVenue}>{venueName}</span>
        <span style={S.courtBadgeName}>{courtName}</span>
      </div>
      {/* Temp debug */}
      <div
        style={{
          color: "red",
          position: "fixed",
          top: 0,
          right: 0,
          fontSize: 12,
        }}
      >
        tn="{tournamentName}" sp={sponsors.length}
      </div>
      {/* Tournament name — top-centre */}
      {tournamentName && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "clamp(12px,2vh,24px) clamp(16px,3vw,48px)",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              fontFamily: "'Bebas Neue', cursive",
              fontSize: "clamp(22px,3vw,42px)",
              letterSpacing: "4px",
              color: "#fff",
              lineHeight: 1,
            }}
          >
            {tournamentName}
          </span>
        </div>
      )}

      {/* Centre content */}
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
          paddingTop: tournamentName ? "clamp(50px,8vh,80px)" : 0,
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
          WAITING FOR MATCH
        </div>

        {/* Up-next card */}
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
            {/* <div
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
            </div> */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: "clamp(10px,1vw,13px)",
                  fontWeight: 700,
                  letterSpacing: 4,
                  color: "rgba(255,255,255,0.25)",
                }}
              >
                UP NEXT
              </span>
              {nextMatch.eventName && (
                <>
                  <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                  <span
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: "clamp(10px,1vw,13px)",
                      fontWeight: 700,
                      letterSpacing: 4,
                      color: "#e8ff47",
                    }}
                  >
                    {nextMatch.eventName.toUpperCase()}
                  </span>
                </>
              )}
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

      {/* ── Sponsor footer ── */}
      {sponsors.length > 0 && (
        <footer style={S.sponsorBar}>
          {/* Title sponsor — always visible */}
          {titleSponsors.length > 0 && (
            <div style={S.titleSlot}>
              <SponsorDisplay sponsor={titleSponsors[0]} tier="title" />
            </div>
          )}

          {titleSponsors.length > 0 && carouselSponsors.length > 0 && (
            <div style={S.sponsorDivider} />
          )}

          {carouselSponsors.length > 0 && (
            <span style={S.sponsorLabel}>
              {titleSponsors.length > 0 ? "ALSO SUPPORTED BY" : "SUPPORTED BY"}
            </span>
          )}

          {carouselSponsors.length > 0 && (
            <div style={S.sponsorRow}>
              {carouselSponsors.map((sp, i) => (
                <div
                  key={sp.id ?? sp.name}
                  style={{
                    ...S.sponsorCell,
                    opacity:
                      carouselSponsors.length <= 4 || i === sponsorIndex
                        ? 1
                        : 0,
                    transition: "opacity 0.8s ease",
                  }}
                >
                  <SponsorDisplay sponsor={sp} />
                </div>
              ))}
            </div>
          )}
        </footer>
      )}

      {/* Live pulse dot */}
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
  const { slug } = useParams();

  // ── State ─────────────────────────────────────────────────────────────────
  const [court, setCourt] = useState(null);
  const [courtError, setCourtError] = useState(null);
  const [courtLoading, setCourtLoading] = useState(true);

  const [matchId, setMatchId] = useState(null);
  const [matchMeta, setMatchMeta] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [sponsors, setSponsors] = useState([]);
  const [tournamentName, setTournamentName] = useState("");

  const [flashTeam, setFlashTeam] = useState(null);
  const [gameWonOverlay, setGameWonOverlay] = useState(null);
  const [matchWonOverlay, setMatchWonOverlay] = useState(null);
  const [sponsorIndex, setSponsorIndex] = useState(0);

  const prevScores = useRef({ t1: null, t2: null });
  const prevMatchWon = useRef(false);

  // ── Sponsor tier buckets ──────────────────────────────────────────────────
  const titleSponsors = sponsors.filter((s) => getTier(s.priority) === "title");
  const goldSponsors = sponsors.filter((s) => getTier(s.priority) === "gold");
  const standardSponsors = sponsors.filter(
    (s) => getTier(s.priority) === "standard",
  );
  const carouselSponsors = [...goldSponsors, ...standardSponsors];

  // ── Break mode — director-controlled via WebSocket ───────────────────────
  const {
    breakMode,
    breakDisplayMode,
    breakVideoUrl,
    breakTournament,
    breakSponsors,
  } = useCourtSocket(slug);
  // ── Helper: fetch sponsors filtered by tournament ID ──────────────────────
  // This is the single source of truth for sponsor fetching.
  // Always filtered by tournament so we never mix sponsors across tournaments.
  const fetchSponsorsForTournament = useCallback(
    (tournamentId, nameHint = "") => {
      if (!tournamentId) return;
      // Set name immediately if we already have it from the match list response
      if (nameHint) setTournamentName(nameHint);
      // Fetch sponsors filtered by tournament
      fetch(
        `${API_BASE}/sponsors/?tournament=${tournamentId}&ordering=-priority`,
      )
        .then((r) => r.json())
        .then((d) => {
          const arr = Array.isArray(d) ? d : (d.results ?? []);
          if (arr.length > 0) setSponsors(arr);
          // ✅ tournament_name comes free with every sponsor object
          if (arr[0].tournament_name) setTournamentName(arr[0].tournament_name);
        })
        .catch((e) => console.error("[CourtScreen] sponsors fetch error:", e));
      // Also fetch tournament detail to get its name (if not already known)
      //   if (!nameHint) {
      //     fetch(`${API_BASE}/tournaments/${tournamentId}/`)
      //       .then((r) => r.json())
      //       .then((d) => {
      //         if (d.name) setTournamentName(d.name);
      //       })
      //       .catch(() => {});
      //   }
    },
    [],
  );

  // ── 1. Resolve court by slug ──────────────────────────────────────────────
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

  // ── 2. Poll for live match + fetch tournament-filtered sponsors ───────────
  //
  // Sponsor fetch priority order:
  //   1. Live match tournament      → always most relevant
  //   2. Upcoming match tournament  → shown during idle/pre-match
  //   3. Most recent completed match tournament → fallback when nothing scheduled
  //
  const pollForMatch = useCallback(async () => {
    if (!court) return;
    try {
      // ── Try live first ────────────────────────────────────────────────────
      const liveRes = await fetch(
        `${API_BASE}/courts/${court.id}/matches/?status=Live`,
      );
      const liveArr = await liveRes
        .json()
        .then((d) => (Array.isArray(d) ? d : (d.results ?? [])));

      if (liveArr.length > 0) {
        const m = liveArr[0];
        setMatchId((prev) => (prev === m.id ? prev : m.id));
        setNextMatch(null);
        // ✅ Priority 1 — fetch sponsors for live match's tournament
        fetchSponsorsForTournament(m.tournament, m.tournament_name ?? "");
        return;
      }

      // ── No live match — clear match state ─────────────────────────────────
      setMatchId(null);
      setMatchMeta(null);

      // ── Try upcoming ──────────────────────────────────────────────────────
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
          eventName: u.event_name ?? "",
        });
        // ✅ Priority 2 — fetch sponsors for upcoming match's tournament
        fetchSponsorsForTournament(u.tournament, u.tournament_name ?? "");
        return;
      }

      // ── No live or upcoming — look for most recent completed match ─────────
      setNextMatch(null);
      const recentRes = await fetch(
        `${API_BASE}/courts/${court.id}/matches/?status=Completed&ordering=-scheduled_time&limit=1`,
      );
      const recent = await recentRes
        .json()
        .then((d) => (Array.isArray(d) ? d : (d.results ?? [])));

      if (recent.length > 0) {
        // ✅ Priority 3 — sponsors from most recent completed match's tournament
        fetchSponsorsForTournament(
          recent[0].tournament,
          recent[0].tournament_name ?? "",
        );
      } else {
        // ✅ Priority 4 — no matches at all on this court, load all sponsors
        // so idle screen is never blank (e.g. fresh court with no history)
        console.log(
          "[CourtScreen] no matches on court — fetching all sponsors",
        );
        fetch(`${API_BASE}/sponsors/?ordering=-priority`)
          .then((r) => r.json())
          .then((d) => {
            const arr = Array.isArray(d) ? d : (d.results ?? []);
            console.log(
              `[CourtScreen] all sponsors fetched: ${arr.length}`,
              arr,
            );
            if (arr.length > 0) setSponsors(arr);
          })
          .catch((e) =>
            console.error("[CourtScreen] all-sponsors fetch error:", e),
          );
      }
    } catch (e) {
      console.error("[CourtScreen] poll error:", e);
    }
  }, [court, fetchSponsorsForTournament]);

  useEffect(() => {
    if (!court) return;
    pollForMatch();
    const t = setInterval(pollForMatch, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [court, pollForMatch]);

  // ── 3. Fetch match metadata when matchId changes ──────────────────────────
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
        if (detail.tournament_name) setTournamentName(detail.tournament_name);
        // Sponsors are already fetched in pollForMatch via fetchSponsorsForTournament,
        // but we re-fetch here too in case matchId changed via WebSocket push
        // (not just polling), ensuring sponsors always match the current match.
        if (detail.tournament) {
          fetchSponsorsForTournament(detail.tournament);
        }
      } catch (e) {
        console.error("[CourtScreen] meta error:", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [matchId, fetchSponsorsForTournament]);

  // ── 4. Live score via WebSocket ───────────────────────────────────────────
  const { state, isConnected } = useMatchSocket(matchId);

  // Re-poll 60 s after match completes — gives time for celebration overlay
  // The 30 s interval above is still running, so a new match is never missed
  // for more than 30 s regardless of this timeout value.
  useEffect(() => {
    if (state.matchWon && !prevMatchWon.current)
      setTimeout(pollForMatch, 60_000);
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
  const gameWonTimerRef = useRef(null);

  useEffect(() => {
    if (state.gameWon && !state.matchWon) {
      clearTimeout(gameWonTimerRef.current);
      setGameWonOverlay({ game: state.currentGame - 1 });
      gameWonTimerRef.current = setTimeout(() => setGameWonOverlay(null), 3500);
    } else {
      clearTimeout(gameWonTimerRef.current);
      setGameWonOverlay(null);
    }
    return () => clearTimeout(gameWonTimerRef.current);
  }, [state.gameWon, state.matchWon]);

  useEffect(() => {
    if (state.matchWon) setMatchWonOverlay({ winner: state.winner });
  }, [state.matchWon, state.winner]);
  useEffect(() => {
    setMatchWonOverlay(null);
  }, [matchId]);
  // ── 7. Sponsor carousel ───────────────────────────────────────────────────
  useEffect(() => {
    if (carouselSponsors.length <= 4) return;
    const t = setInterval(() => {
      setSponsorIndex((i) => (i + 1) % carouselSponsors.length);
    }, 4000);
    return () => clearInterval(t);
  }, [carouselSponsors.length]);
  // Director activated break mode — override everything with the sponsor showcase
  if (breakMode) {
    return (
      <BreakScreen
        tournamentName={breakTournament || tournamentName}
        sponsors={breakSponsors.length > 0 ? breakSponsors : sponsors}
        videoUrl={breakVideoUrl}
        displayMode={breakDisplayMode}
      />
    );
  }
  // ── Guards ────────────────────────────────────────────────────────────────
  if (courtLoading) return <FullScreenMessage text="LOADING…" pulse />;
  if (courtError)
    return <FullScreenMessage text="COURT NOT FOUND" sub={courtError} />;
  if (!matchId || !matchMeta) {
    return (
      <IdleScreen
        courtName={court.name}
        venueName={court.venue_name}
        nextMatch={nextMatch}
        sponsors={sponsors}
        tournamentName={tournamentName}
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

  const matchType = p.match_type ?? "";
  const eventName = p.event_name ?? "";

  const isLive = state.status === "Live" || p.status === "Live";
  const isUpcoming = state.status === "Upcoming" || p.status === "Upcoming";

  const isTeam1Serving =
    state.serverId &&
    (state.serverId === (p.player1_team1_detail?.id ?? p.player1_team1?.id) ||
      state.serverId === (p.player2_team1_detail?.id ?? p.player2_team1?.id));

  // Visible carousel slice (up to 4 sponsors shown at once)
  const visibleCarouselIndices = [0, 1, 2, 3].map(
    (offset) => (sponsorIndex + offset) % (carouselSponsors.length || 1),
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Court identity badge */}
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

      {/* Match won overlay */}
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

            {/* Title sponsor "PRESENTED BY" moment */}
            {titleSponsors.length > 0 && (
              <div style={S.overlayPresentedBy}>
                <div style={S.overlayPresentedByLabel}>PRESENTED BY</div>
                <SponsorDisplay sponsor={titleSponsors[0]} tier="title" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top bar — 3-column grid */}
      <header style={S.topBar}>
        {/* Col 1 — empty (balances status block on the right) */}
        <div />

        {/* Col 2 — tournament name + event/match-type pills */}
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
            {eventName ? (
              <>
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
                <span
                  style={{
                    color: "rgba(255,255,255,0.2)",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  ›
                </span>
                <span style={S.matchTypePill}>{matchType}</span>
              </>
            ) : (
              <span style={S.matchTypePill}>{matchType}</span>
            )}
          </div>
        </div>

        {/* Col 3 — live badge + connection dot */}
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
        {/* Team 1 — left */}
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
          <div style={S.setDotsRow}>
            <SetDots count={state.team1Sets} />
            <span style={S.setLabel}>SETS</span>
            <SetDots count={state.team2Sets} />
          </div>

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

          {/* Completed game history pills */}
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

          {/* Countdown when upcoming */}
          {isUpcoming && p?.scheduled_time && (
            <CountdownTimer scheduledTime={p.scheduled_time} />
          )}
        </div>

        {/* Team 2 — right */}
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

      {/* Sponsor footer */}
      {sponsors.length > 0 && (
        <footer style={S.sponsorBar}>
          {/* Title sponsor — always anchored left, never cycles */}
          {titleSponsors.length > 0 && (
            <div style={S.titleSlot}>
              <SponsorDisplay sponsor={titleSponsors[0]} tier="title" />
            </div>
          )}

          {titleSponsors.length > 0 && carouselSponsors.length > 0 && (
            <div style={S.sponsorDivider} />
          )}

          {carouselSponsors.length > 0 && (
            <span style={S.sponsorLabel}>
              {titleSponsors.length > 0 ? "ALSO SUPPORTED BY" : "SUPPORTED BY"}
            </span>
          )}

          {carouselSponsors.length > 0 && (
            <div style={S.sponsorRow}>
              {carouselSponsors.length <= 4
                ? carouselSponsors.map((sp) => (
                    <div key={sp.id ?? sp.name} style={S.sponsorCell}>
                      <SponsorDisplay sponsor={sp} />
                    </div>
                  ))
                : carouselSponsors.map((sp, i) => {
                    const isVisible = visibleCarouselIndices.includes(i);
                    const slot = visibleCarouselIndices.indexOf(i);
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
// ─────────────────────────────────────────────────────────────────────────────
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
  topBar: {
    position: "relative",
    zIndex: 10,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    padding: "clamp(12px,2vh,24px) clamp(16px,3vw,48px)",
  },
  tournamentBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
  tournamentName: {
    fontFamily: "'Bebas Neue', cursive",
    fontSize: "clamp(22px,3vw,42px)",
    letterSpacing: "4px",
    color: "#fff",
    lineHeight: 1,
  },
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
  statusBlock: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    justifyContent: "flex-end",
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
  main: {
    position: "relative",
    zIndex: 10,
    flex: 1,
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "clamp(8px,2vw,32px)",
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
    minHeight: "clamp(80px,10vh,100px)",
  },
  titleSlot: { flexShrink: 0 },
  sponsorDivider: {
    width: 1,
    alignSelf: "stretch",
    background: "rgba(255,255,255,0.08)",
    flexShrink: 0,
    margin: "4px 0",
  },
  sponsorLabel: {
    fontSize: "clamp(8px,0.7vw,10px)",
    fontWeight: "700",
    letterSpacing: "3px",
    color: "rgba(255,255,255,0.18)",
    whiteSpace: "nowrap",
    flexShrink: 0,
    fontFamily: "'DM Sans', sans-serif",
    writingMode: "vertical-rl",
    transform: "rotate(180deg)",
  },
  sponsorRow: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "clamp(8px,1.5vw,20px)",
    position: "relative",
    minHeight: 72,
  },
  sponsorCell: { flexShrink: 0 },
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
