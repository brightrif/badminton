// src/pages/UmpireDashboard.jsx
//
// Shown after a logged-in umpire authenticates via JWT.
// Fetches only matches assigned to them via GET /api/matches/my_matches/
// Clicking a live/upcoming match silently fetches the HMAC token
// then navigates to /umpire/<id>/score — same destination as PIN flow.
//
// PIN flow (UmpirePinEntry) is completely unchanged and still works.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Token helpers ────────────────────────────────────────────────────────────

function getAccessToken() {
  return localStorage.getItem("access_token");
}

async function refreshAccessToken() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;
  const res = await fetch(`${API_BASE}/api/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const { access } = await res.json();
  localStorage.setItem("access_token", access);
  return access;
}

async function authFetch(url, options = {}) {
  let token = getAccessToken();
  let res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  // Try refresh once on 401
  if (res.status === 401) {
    token = await refreshAccessToken();
    if (!token) return res;
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
  }
  return res;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function teamLabel(match) {
  const t1 = [match.player1_team1_name, match.player2_team1_name]
    .filter(Boolean)
    .join(" / ");
  const t2 = [match.player1_team2_name, match.player2_team2_name]
    .filter(Boolean)
    .join(" / ");
  return { t1, t2 };
}

// ─── MatchCard ────────────────────────────────────────────────────────────────

function MatchCard({ match, onEnter, loading }) {
  const { t1, t2 } = teamLabel(match);
  const isLive = match.status === "Live";
  const isUpcoming = match.status === "Upcoming";
  const isCompleted = match.status === "Completed";
  const canEnter = isLive || isUpcoming;

  return (
    <div style={{ ...S.card, opacity: isCompleted ? 0.7 : 1 }}>
      {/* Status pill */}
      <div
        style={{
          ...S.pill,
          ...(isLive ? S.pillLive : isUpcoming ? S.pillUpcoming : S.pillDone),
        }}
      >
        {isLive && <span style={S.liveDot} />}
        {match.status}
      </div>

      {/* Teams */}
      <div style={S.teams}>
        <span style={S.team}>{t1}</span>
        <span style={S.vs}>vs</span>
        <span style={S.team}>{t2}</span>
      </div>

      {/* Meta */}
      <div style={S.meta}>
        {match.tournament_name && (
          <span style={S.metaItem}>🏆 {match.tournament_name}</span>
        )}
        {match.venue_name && (
          <span style={S.metaItem}>📍 {match.venue_name}</span>
        )}
        {match.court_name && (
          <span style={S.metaItem}>🏸 {match.court_name}</span>
        )}
        <span style={S.metaItem}>🕐 {formatTime(match.scheduled_time)}</span>
      </div>

      {/* Score summary for completed matches */}
      {isCompleted && (
        <div style={S.scoreSummary}>
          {match.team1_sets} – {match.team2_sets}
        </div>
      )}

      {/* Enter button */}
      {canEnter && (
        <button
          style={{
            ...S.enterBtn,
            ...(isLive ? S.enterBtnLive : S.enterBtnUpcoming),
            opacity: loading === match.id ? 0.6 : 1,
            cursor: loading === match.id ? "not-allowed" : "pointer",
          }}
          onClick={() => onEnter(match)}
          disabled={loading === match.id}
        >
          {loading === match.id
            ? "CONNECTING…"
            : isLive
              ? "▶ ENTER LIVE MATCH"
              : "▶ ENTER MATCH"}
        </button>
      )}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function Section({ title, matches, onEnter, loading, emptyMsg }) {
  return (
    <div style={S.section}>
      <div style={S.sectionHead}>{title}</div>
      {matches.length === 0 ? (
        <div style={S.empty}>{emptyMsg}</div>
      ) : (
        matches.map((m) => (
          <MatchCard key={m.id} match={m} onEnter={onEnter} loading={loading} />
        ))
      )}
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function UmpireDashboard() {
  const navigate = useNavigate();

  const [matches, setMatches] = useState({
    live: [],
    upcoming: [],
    completed: [],
  });
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [entering, setEntering] = useState(null); // match.id being entered

  // Who is logged in?
  const [umpireName, setUmpireName] = useState("");

  // ── Fetch assigned matches ─────────────────────────────────────────────────
  const loadMatches = useCallback(async () => {
    setFetching(true);
    setError("");
    try {
      const res = await authFetch(`${API_BASE}/matches/my_matches/`);
      if (res.status === 401) {
        // Token expired and refresh failed — send back to login
        navigate("/umpire/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load matches.");
      const data = await res.json();
      setMatches(data);

      // Try to get umpire name from token payload
      const token = getAccessToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          setUmpireName(
            payload.name || payload.username || payload.email || "",
          );
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadMatches();
    // Auto-refresh every 30 seconds so live matches appear without reload
    const interval = setInterval(loadMatches, 30_000);
    return () => clearInterval(interval);
  }, [loadMatches]);

  // ── Enter a match: silently fetch HMAC token then navigate ────────────────
  const handleEnter = async (match) => {
    setEntering(match.id);
    try {
      const res = await authFetch(
        `${API_BASE}/matches/${match.id}/umpire_token/`,
        { method: "POST" },
      );

      if (res.status === 403) {
        // Not assigned — fall back to PIN entry for this match
        navigate(`/umpire/pin?match=${match.id}`);
        return;
      }

      if (!res.ok) throw new Error("Could not get match access token.");

      const { token } = await res.json();
      // Store in sessionStorage (cleared when tab closes — safer than localStorage)
      sessionStorage.setItem(`umpire_token_${match.id}`, token);
      navigate(`/umpire/${match.id}/score`);
    } catch (e) {
      setError(e.message);
    } finally {
      setEntering(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    navigate("/umpire/login");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <div style={S.page}>
        <div style={S.loading}>Loading your matches…</div>
      </div>
    );
  }

  const totalAssigned =
    matches.live.length + matches.upcoming.length + matches.completed.length;

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.greeting}>
            {umpireName ? `Welcome, ${umpireName}` : "Umpire Dashboard"}
          </div>
          <div style={S.subGreeting}>
            {totalAssigned === 0
              ? "No matches assigned yet"
              : `${matches.live.length + matches.upcoming.length} match${
                  matches.live.length + matches.upcoming.length !== 1
                    ? "es"
                    : ""
                } to umpire`}
          </div>
        </div>
        <div style={S.headerRight}>
          <button style={S.refreshBtn} onClick={loadMatches}>
            ↻ Refresh
          </button>
          <button style={S.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      {error && <div style={S.errorBanner}>⚠ {error}</div>}

      {/* Match sections */}
      <div style={S.content}>
        <Section
          title="🔴 Live now"
          matches={matches.live}
          onEnter={handleEnter}
          loading={entering}
          emptyMsg="No live matches right now."
        />
        <Section
          title="🕐 Upcoming"
          matches={matches.upcoming}
          onEnter={handleEnter}
          loading={entering}
          emptyMsg="No upcoming matches assigned."
        />
        <Section
          title="✓ Recent results"
          matches={matches.completed}
          onEnter={handleEnter}
          loading={entering}
          emptyMsg="No completed matches yet."
        />
      </div>

      {/* PIN fallback hint */}
      <div style={S.pinHint}>
        Not your match?{" "}
        <span style={S.pinLink} onClick={() => navigate("/umpire/pin")}>
          Enter via PIN instead →
        </span>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0e1a",
    color: "#f1f5f9",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: "0 0 48px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "24px 24px 20px",
    borderBottom: "1px solid #1e293b",
    flexWrap: "wrap",
    gap: "12px",
  },
  greeting: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#f8fafc",
  },
  subGreeting: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "4px",
  },
  headerRight: {
    display: "flex",
    gap: "10px",
  },
  refreshBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "7px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    cursor: "pointer",
  },
  logoutBtn: {
    background: "transparent",
    border: "1px solid #334155",
    color: "#94a3b8",
    padding: "7px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    cursor: "pointer",
  },
  content: {
    maxWidth: "720px",
    margin: "0 auto",
    padding: "24px 16px 0",
  },
  section: {
    marginBottom: "32px",
  },
  sectionHead: {
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.12em",
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: "12px",
  },
  empty: {
    fontSize: "13px",
    color: "#334155",
    padding: "16px 0",
  },
  card: {
    background: "#1e293b",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "12px",
    border: "1px solid #273449",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: "600",
    letterSpacing: "0.1em",
    padding: "3px 10px",
    borderRadius: "20px",
    marginBottom: "10px",
    textTransform: "uppercase",
  },
  pillLive: { background: "#450a0a", color: "#fca5a5" },
  pillUpcoming: { background: "#0c1a33", color: "#93c5fd" },
  pillDone: { background: "#0f2016", color: "#86efac" },
  liveDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#ef4444",
    animation: "pulse 1.5s infinite",
  },
  teams: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "10px",
    flexWrap: "wrap",
  },
  team: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#f1f5f9",
  },
  vs: {
    fontSize: "12px",
    color: "#475569",
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "14px",
  },
  metaItem: {
    fontSize: "12px",
    color: "#64748b",
  },
  scoreSummary: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#94a3b8",
    marginBottom: "4px",
  },
  enterBtn: {
    width: "100%",
    padding: "12px",
    borderRadius: "8px",
    border: "none",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    transition: "opacity 0.15s",
  },
  enterBtnLive: { background: "#dc2626", color: "#fff" },
  enterBtnUpcoming: { background: "#1d4ed8", color: "#fff" },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    fontSize: "16px",
    color: "#475569",
  },
  errorBanner: {
    background: "#450a0a",
    color: "#fca5a5",
    padding: "12px 24px",
    fontSize: "13px",
  },
  pinHint: {
    textAlign: "center",
    fontSize: "13px",
    color: "#334155",
    marginTop: "32px",
  },
  pinLink: {
    color: "#e8ff47",
    cursor: "pointer",
    textDecoration: "underline",
  },
};
