// src/pages/spectator/PublicBracket.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams } from "react-router-dom";
import SpectatorLayout, {
  SKEL_STYLE,
} from "../../components/spectator/SpectatorLayout";
import BracketTree from "../../components/spectator/BracketTree";
import PlayerJourney from "../../components/spectator/PlayerJourney";
import PlayerSearch from "../../components/spectator/PlayerSearch";
import { usePublicSocket } from "../../hooks/usePublicSocket";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const POLL_INTERVAL = 30_000;

function LiveConnector({ matchId, onScore }) {
  const { score } = usePublicSocket(matchId);
  useEffect(() => {
    onScore(matchId, score);
  }, [matchId, score, onScore]);
  return null;
}

function BracketSkeleton() {
  return (
    <div
      style={{ display: "flex", gap: 12, padding: "20px 0", overflowX: "auto" }}
    >
      {[1, 2, 3, 4].map((col) => (
        <div
          key={col}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minWidth: 148,
          }}
        >
          <div
            style={{
              ...SKEL_STYLE,
              height: 12,
              width: 80,
              alignSelf: "center",
              marginBottom: 6,
            }}
          />
          {Array.from({ length: Math.max(1, 8 >> col) }).map((_, i) => (
            <div
              key={i}
              style={{ ...SKEL_STYLE, height: 66, borderRadius: 10 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PublicBracket() {
  const { id: tournamentId, eventId } = useParams();
  //   const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [bracketMatches, setBracketMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [liveScores, setLiveScores] = useState({});

  const pollRef = useRef(null);
  const refetchRef = useRef(null);

  const fetchBracket = useCallback(
    async (quiet = false) => {
      try {
        if (!quiet) setLoading(true);
        const res = await fetch(`${API_BASE}/events/${eventId}/bracket/`);
        if (!res.ok) throw new Error(`Could not load bracket (${res.status})`);
        const data = await res.json();
        setEvent(data);
        setBracketMatches(data.bracket_matches || []);
        setError(null);
      } catch (err) {
        if (!quiet) setError(err.message);
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [eventId],
  );

  useEffect(() => {
    fetchBracket();
  }, [fetchBracket]);
  useEffect(() => {
    pollRef.current = setInterval(() => fetchBracket(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchBracket]);

  const handleScore = useCallback(
    (matchId, score) => {
      setLiveScores((prev) => ({ ...prev, [matchId]: score }));
      if (score.matchWon) {
        clearTimeout(refetchRef.current);
        refetchRef.current = setTimeout(() => fetchBracket(true), 1500);
      }
    },
    [fetchBracket],
  );

  const liveMatchIds = useMemo(
    () =>
      bracketMatches
        .filter(
          (bm) => bm.match_detail?.status === "Live" && bm.match_detail?.id,
        )
        .map((bm) => bm.match_detail.id),
    [bracketMatches],
  );

  const handlePlayerSelect = (name) => {
    setSelectedPlayer(name);
    setPlayerSearch(name);
  };
  const handleSearchChange = (val) => {
    setPlayerSearch(val);
    setSelectedPlayer(val || null);
  };
  const handleClose = () => {
    setSelectedPlayer(null);
    setPlayerSearch("");
  };

  const stats = useMemo(
    () => ({
      total: bracketMatches.filter((b) => !b.is_bye).length,
      completed: bracketMatches.filter(
        (b) => b.match_detail?.status === "Completed",
      ).length,
      live: bracketMatches.filter((b) => b.match_detail?.status === "Live")
        .length,
      upcoming: bracketMatches.filter(
        (b) => b.match_detail?.status === "Upcoming",
      ).length,
    }),
    [bracketMatches],
  );

  const breadcrumbs = [
    { label: "Tournaments", to: "/spectator" },
    {
      label: event?.tournament_name || "Tournament",
      to: `/spectator/tournament/${tournamentId}`,
    },
    { label: event?.name || "Bracket" },
  ];

  return (
    <SpectatorLayout
      title={event?.name || "Bracket"}
      breadcrumbs={breadcrumbs}
      liveCount={stats.live}
    >
      {liveMatchIds.map((mid) => (
        <LiveConnector key={mid} matchId={mid} onScore={handleScore} />
      ))}

      <div style={PB.page}>
        {/* Subtitle + pills */}
        {event && (
          <div style={PB.subHeader}>
            <p style={PB.subMeta}>
              {event.tournament_name}
              <span style={PB.fmtBadge}>
                {event.format_display || event.format}
              </span>
            </p>
            <div style={PB.pills}>
              {stats.live > 0 && (
                <span style={{ ...PB.pill, ...PB.pillGreen }}>
                  <span style={PB.liveDot} />
                  {stats.live} live
                </span>
              )}
              {stats.upcoming > 0 && (
                <span style={{ ...PB.pill, ...PB.pillBlue }}>
                  {stats.upcoming} upcoming
                </span>
              )}
              {stats.completed > 0 && (
                <span style={{ ...PB.pill, ...PB.pillGray }}>
                  {stats.completed}/{stats.total} played
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div style={PB.errorBox}>
            <span>⚠️</span>
            <div>
              <strong style={{ color: "#f87171" }}>
                Could not load bracket
              </strong>
              <p
                style={{
                  fontSize: 12,
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 3,
                }}
              >
                {error}
              </p>
            </div>
            <button style={PB.accentBtn} onClick={() => fetchBracket()}>
              Retry
            </button>
          </div>
        )}

        {!error && (
          <div style={PB.search}>
            <PlayerSearch
              value={playerSearch}
              onChange={handleSearchChange}
              placeholder="Search player to highlight their path…"
            />
            {playerSearch && (
              <div style={PB.searchHint}>
                Tap a name in the bracket to see their full journey
              </div>
            )}
          </div>
        )}

        <div style={PB.bracketWrap}>
          {loading ? (
            <BracketSkeleton />
          ) : (
            <BracketTree
              bracketMatches={bracketMatches}
              highlightPlayer={selectedPlayer}
              liveScores={liveScores}
              onPlayerSelect={handlePlayerSelect}
            />
          )}
        </div>

        {!loading && bracketMatches.length > 0 && (
          <div style={PB.legend}>
            <span style={PB.legItem}>
              <span style={{ ...PB.legDot, background: "#c8ff00" }} /> Live
            </span>
            <span style={PB.legItem}>
              <span
                style={{ ...PB.legDot, background: "rgba(200,255,0,0.3)" }}
              />{" "}
              Completed
            </span>
            <span style={PB.legItem}>
              <span
                style={{
                  ...PB.legDot,
                  border: "1px solid rgba(200,255,0,0.12)",
                  background: "transparent",
                }}
              />{" "}
              Upcoming
            </span>
            {selectedPlayer && (
              <>
                <span style={PB.legItem}>
                  <span
                    style={{ ...PB.legDot, background: "rgba(200,255,0,0.7)" }}
                  />{" "}
                  Won
                </span>
                <span style={PB.legItem}>
                  <span
                    style={{
                      ...PB.legDot,
                      background: "rgba(255,100,100,0.7)",
                    }}
                  />{" "}
                  Lost
                </span>
              </>
            )}
            <span style={{ flex: 1 }} />
            <span
              style={{
                fontSize: 10,
                color: "rgba(200,255,0,0.2)",
                fontStyle: "italic",
              }}
            >
              Tap any name for journey
            </span>
          </div>
        )}
      </div>

      {/* Player journey panel */}
      {selectedPlayer && (
        <>
          <div style={PB.backdrop} onClick={handleClose} />
          <div style={{ ...PB.panel, animation: "slideUp 0.25s ease" }}>
            <PlayerJourney
              bracketMatches={bracketMatches}
              playerName={selectedPlayer}
              liveScores={liveScores}
              onClose={handleClose}
            />
          </div>
        </>
      )}
    </SpectatorLayout>
  );
}

const PB = {
  page: { padding: "0 0 60px" },
  subHeader: { padding: "14px 20px 0" },
  subMeta: {
    fontSize: 12,
    color: "rgba(200,255,0,0.35)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  },
  fmtBadge: {
    fontSize: 10,
    fontWeight: 600,
    color: "#a78bfa",
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 8,
    padding: "1px 8px",
  },
  pills: { display: "flex", gap: 6, flexWrap: "wrap" },
  pill: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: 20,
  },
  pillGreen: {
    background: "rgba(200,255,0,0.1)",
    color: "#c8ff00",
    border: "1px solid rgba(200,255,0,0.2)",
  },
  pillBlue: {
    background: "rgba(100,180,255,0.08)",
    color: "#93c5fd",
    border: "1px solid rgba(100,180,255,0.15)",
  },
  pillGray: {
    background: "rgba(200,255,0,0.04)",
    color: "rgba(200,255,0,0.4)",
    border: "1px solid rgba(200,255,0,0.08)",
  },
  liveDot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#c8ff00",
    animation: "pulse 1.5s infinite",
    flexShrink: 0,
  },
  search: {
    padding: "12px 20px",
    background: "rgba(8,16,0,0.3)",
    borderBottom: "1px solid rgba(200,255,0,0.05)",
  },
  searchHint: {
    fontSize: 11,
    color: "rgba(200,255,0,0.2)",
    marginTop: 6,
    paddingLeft: 2,
  },
  bracketWrap: { padding: "16px 20px 0", overflowX: "auto" },
  legend: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 20px",
    flexWrap: "wrap",
  },
  legItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    color: "rgba(200,255,0,0.3)",
  },
  legDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
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
    marginLeft: "auto",
    flexShrink: 0,
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
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    borderRadius: "16px 16px 0 0",
    boxShadow: "0 -4px 40px rgba(0,20,0,0.8)",
    maxHeight: "78vh",
    overflowY: "auto",
    border: "1px solid rgba(200,255,0,0.1)",
  },
};
