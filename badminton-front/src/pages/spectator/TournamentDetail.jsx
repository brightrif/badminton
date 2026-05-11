// src/pages/spectator/TournamentDetail.jsx
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SpectatorLayout, {
  SKEL_STYLE,
} from "../../components/spectator/SpectatorLayout";
import DayFilter from "../../components/spectator/DayFilter";
import EventTabs from "../../components/spectator/EventTabs";
import MatchCard from "../../components/spectator/MatchCard";
import PlayerSearch from "../../components/spectator/PlayerSearch";
import CrossEventJourneyPanel from "../../components/spectator/CrossEventJourneyPanel";
import { usePublicSocket } from "../../hooks/usePublicSocket";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const POLL_INTERVAL = 30_000;

function fmt(start, end) {
  if (!start) return "";
  const s = new Date(start),
    e = new Date(end);
  const o = { day: "numeric", month: "short", year: "numeric" };
  if (!end || start === end) return s.toLocaleDateString("en-GB", o);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", o)}`;
}
function hasPlayer(match, q) {
  if (!q) return true;
  const lq = q.toLowerCase();
  return [
    match.player1_team1_name,
    match.player2_team1_name,
    match.player1_team2_name,
    match.player2_team2_name,
  ]
    .filter(Boolean)
    .some((n) => n.toLowerCase().includes(lq));
}

function SectionHeader({ label, count, live }) {
  return (
    <div style={D.sectionHead}>
      {live && <span style={D.secDot} />}
      <span style={D.secLabel}>{label}</span>
      <span style={D.secCount}>{count}</span>
    </div>
  );
}
function SkeletonMatch() {
  return (
    <div style={D.skelCard}>
      <div
        style={{ ...SKEL_STYLE, width: "30%", height: 12, marginBottom: 12 }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ ...SKEL_STYLE, width: "35%", height: 16 }} />
        <div style={{ ...SKEL_STYLE, width: "14%", height: 22 }} />
        <div style={{ ...SKEL_STYLE, width: "35%", height: 16 }} />
      </div>
    </div>
  );
}
function LiveConnector({ matchId, onScore }) {
  const { score } = usePublicSocket(matchId);
  useEffect(() => {
    onScore(matchId, score);
  }, [matchId, score, onScore]);
  return null;
}

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [events, setEvents] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [liveScores, setLiveScores] = useState({});
  const pollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [tRes, eRes, mRes] = await Promise.all([
        fetch(`${API_BASE}/tournaments/${id}/`),
        fetch(`${API_BASE}/events/?tournament=${id}&ordering=name`),
        fetch(`${API_BASE}/matches/?tournament=${id}&ordering=scheduled_time`),
      ]);
      if (!tRes.ok) throw new Error(`Tournament not found (${tRes.status})`);
      const [t, e, m] = await Promise.all([
        tRes.json(),
        eRes.json(),
        mRes.json(),
      ]);
      setTournament(t);
      setEvents(Array.isArray(e) ? e : (e.results ?? []));
      setMatches(Array.isArray(m) ? m : (m.results ?? []));
      setSelectedDate((prev) => {
        if (prev !== null) return prev;
        const today = new Date().toISOString().slice(0, 10);
        return t.start_date <= today && today <= t.end_date ? today : null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${API_BASE}/matches/?tournament=${id}&ordering=scheduled_time`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setMatches(Array.isArray(data) ? data : (data.results ?? []));
      } catch {
        // silent — background poll, don't show errors to spectators
      }
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [id]);

  const handleScore = useCallback(
    (matchId, score) => {
      setLiveScores((prev) => ({ ...prev, [matchId]: score }));
      if (score.matchWon) {
        setTimeout(() => {
          fetch(`${API_BASE}/matches/?tournament=${id}&ordering=scheduled_time`)
            .then((r) => r.json())
            .then((d) => setMatches(Array.isArray(d) ? d : (d.results ?? [])))
            .catch(() => {});
        }, 1500);
      }
    },
    [id],
  );

  const filtered = useMemo(
    () =>
      matches.filter((m) => {
        if (
          selectedDate &&
          (!m.scheduled_time || m.scheduled_time.slice(0, 10) !== selectedDate)
        )
          return false;
        if (selectedEventId !== null && m.event !== selectedEventId)
          return false;
        if (!hasPlayer(m, playerSearch)) return false;
        return true;
      }),
    [matches, selectedDate, selectedEventId, playerSearch],
  );

  const liveMatches = useMemo(
    () => filtered.filter((m) => m.status === "Live"),
    [filtered],
  );
  const upcomingMatches = useMemo(
    () => filtered.filter((m) => m.status === "Upcoming"),
    [filtered],
  );
  const completedMatches = useMemo(
    () => filtered.filter((m) => m.status === "Completed"),
    [filtered],
  );

  const liveCountMap = useMemo(() => {
    const map = {};
    matches
      .filter((m) => m.status === "Live")
      .forEach((m) => {
        if (m.event) map[m.event] = (map[m.event] || 0) + 1;
      });
    return map;
  }, [matches]);

  const liveMatchIds = useMemo(
    () => matches.filter((m) => m.status === "Live").map((m) => m.id),
    [matches],
  );
  const totalLive = matches.filter((m) => m.status === "Live").length;

  const breadcrumbs = [
    { label: "Tournaments", to: "/spectator" },
    { label: tournament?.name || "Tournament" },
  ];
  const venueStr = (tournament?.venues_detail || [])
    .map((v) => v.venue_name)
    .filter(Boolean)
    .join(", ");

  return (
    <SpectatorLayout
      title={tournament?.name || "Tournament"}
      breadcrumbs={breadcrumbs}
      liveCount={totalLive}
    >
      {liveMatchIds.map((mid) => (
        <LiveConnector key={mid} matchId={mid} onScore={handleScore} />
      ))}

      <div style={D.page}>
        {/* Tournament subtitle */}
        {tournament && (
          <div style={D.subHeader}>
            <p style={D.subMeta}>
              {fmt(tournament.start_date, tournament.end_date)}
              {venueStr ? ` · ${venueStr}` : ""}
            </p>
          </div>
        )}

        {error && (
          <div style={D.errorBox}>
            <span>⚠️</span>
            <div>
              <strong style={{ color: "#ff6b6b" }}>
                Could not load tournament
              </strong>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 3,
                }}
              >
                {error}
              </p>
            </div>
            <button style={D.accentBtn} onClick={fetchAll}>
              Retry
            </button>
          </div>
        )}

        {!error && (
          <div style={D.filters}>
            <PlayerSearch
              value={playerSearch}
              onChange={setPlayerSearch}
              placeholder="Search player…"
            />
            {tournament && (
              <div style={{ marginTop: 12 }}>
                <div style={D.filterLabel}>Filter by day</div>
                <DayFilter
                  startDate={tournament.start_date}
                  endDate={tournament.end_date}
                  selectedDate={selectedDate}
                  onChange={setSelectedDate}
                />
              </div>
            )}
            {events.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <EventTabs
                  events={events}
                  selectedEventId={selectedEventId}
                  onChange={setSelectedEventId}
                  onBracketClick={(evId) =>
                    navigate(
                      `/spectator/tournament/${id}/event/${evId}/bracket`,
                    )
                  }
                  liveCountMap={liveCountMap}
                />
              </div>
            )}
          </div>
        )}

        <div style={D.matchList}>
          {loading && (
            <>
              <SkeletonMatch />
              <SkeletonMatch />
              <SkeletonMatch />
            </>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={D.emptyBox}>
              <span style={{ fontSize: 32, marginBottom: 10 }}>🏸</span>
              <p style={{ fontWeight: 600, color: "#fff", marginBottom: 6 }}>
                {playerSearch
                  ? `No matches for "${playerSearch}"`
                  : selectedDate
                    ? "No matches scheduled for this day"
                    : "No matches available"}
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                {playerSearch
                  ? "Try a different name."
                  : "Check back later or select a different day."}
              </p>
              {(playerSearch || selectedDate) && (
                <button
                  style={{ ...D.accentBtn, marginTop: 14 }}
                  onClick={() => {
                    setPlayerSearch("");
                    setSelectedDate(null);
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && liveMatches.length > 0 && (
            <div>
              <SectionHeader label="Live now" count={liveMatches.length} live />
              <div style={D.cards}>
                {liveMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    liveScore={liveScores[m.id] || null}
                    onPlayerSelect={(n) => setSelectedPlayer(n)}
                  />
                ))}
              </div>
            </div>
          )}
          {!loading && upcomingMatches.length > 0 && (
            <div>
              <SectionHeader label="Upcoming" count={upcomingMatches.length} />
              <div style={D.cards}>
                {upcomingMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    onPlayerSelect={(n) => setSelectedPlayer(n)}
                  />
                ))}
              </div>
            </div>
          )}
          {!loading && completedMatches.length > 0 && (
            <div>
              <SectionHeader
                label="Completed"
                count={completedMatches.length}
              />
              <div style={D.cards}>
                {completedMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    onPlayerSelect={(n) => setSelectedPlayer(n)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedPlayer && (
        <>
          <div style={D.backdrop} onClick={() => setSelectedPlayer(null)} />
          <div style={{ ...D.panel, animation: "slideUp 0.25s ease" }}>
            <CrossEventJourneyPanel
              playerName={selectedPlayer}
              matches={matches}
              liveScores={liveScores}
              onClose={() => setSelectedPlayer(null)}
              tournamentId={id}
              events={events}
            />
          </div>
        </>
      )}
    </SpectatorLayout>
  );
}

const D = {
  page: { padding: "0 0 60px" },
  subHeader: { padding: "12px 20px 0" },
  subMeta: { fontSize: 12, color: "rgba(200,255,0,0.35)" },
  filters: {
    padding: "14px 20px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    background: "rgba(8,16,0,0.4)",
    backdropFilter: "blur(8px)",
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(200,255,0,0.25)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: 8,
  },
  matchList: {
    padding: "14px 20px 0",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  cards: { display: "flex", flexDirection: "column", gap: 7, marginTop: 8 },
  sectionHead: { display: "flex", alignItems: "center", gap: 7 },
  secDot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#c8ff00",
    boxShadow: "0 0 0 2px rgba(200,255,0,0.15)",
    flexShrink: 0,
    animation: "pulse 1.5s infinite",
  },
  secLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(200,255,0,0.5)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  secCount: {
    fontSize: 10,
    color: "rgba(200,255,0,0.35)",
    background: "rgba(200,255,0,0.05)",
    border: "1px solid rgba(200,255,0,0.08)",
    borderRadius: 10,
    padding: "1px 7px",
    fontWeight: 500,
  },
  emptyBox: {
    background: "rgba(15,26,0,0.5)",
    border: "1px solid rgba(200,255,0,0.08)",
    borderRadius: 14,
    padding: "36px 20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  errorBox: {
    margin: "14px 20px 0",
    background: "rgba(255,100,100,0.06)",
    border: "1px solid rgba(255,100,100,0.18)",
    borderRadius: 12,
    padding: "14px",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    fontSize: 14,
    fontWeight: 600,
  },
  accentBtn: {
    background: "#c8ff00",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  skelCard: {
    background: "rgba(15,26,0,0.4)",
    border: "1px solid rgba(200,255,0,0.06)",
    borderRadius: 12,
    padding: "14px",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,8,0,0.8)",
    zIndex: 40,
  },
  panel: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    background: "rgba(8,16,0,0.96)",
    borderRadius: "16px 16px 0 0",
    boxShadow: "0 -4px 40px rgba(0,0,0,0.6)",
    maxHeight: "78vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid rgba(200,255,0,0.1)",
    backdropFilter: "blur(20px)",
  },
};
