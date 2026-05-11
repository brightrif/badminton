// src/pages/spectator/TournamentList.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SpectatorLayout, {
  SKEL_STYLE,
} from "../../components/spectator/SpectatorLayout";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function formatDateRange(start, end) {
  if (!start) return "";
  const s = new Date(start),
    e = new Date(end);
  const o = { day: "numeric", month: "short", year: "numeric" };
  if (!end || start === end) return s.toLocaleDateString("en-GB", o);
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear())
    return `${s.getDate()}–${e.getDate()} ${s.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
  return `${s.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-GB", o)}`;
}
function getStatus(start, end) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const s = new Date(start),
    e = new Date(end);
  e.setHours(23, 59, 59, 999);
  if (t < s) return "upcoming";
  if (t > e) return "completed";
  return "active";
}

function SkeletonCard() {
  return (
    <div style={T.card}>
      <div
        style={{ ...SKEL_STYLE, height: 18, width: "55%", marginBottom: 10 }}
      />
      <div
        style={{ ...SKEL_STYLE, height: 12, width: "40%", marginBottom: 14 }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{ ...SKEL_STYLE, height: 20, width: 70, borderRadius: 20 }}
        />
        <div
          style={{ ...SKEL_STYLE, height: 20, width: 80, borderRadius: 20 }}
        />
      </div>
    </div>
  );
}

function TournamentCard({ t, onClick }) {
  const status = getStatus(t.start_date, t.end_date);
  const isLive = t.live_matches_count > 0;
  const venues = (t.venues_detail || [])
    .map((v) => v.venue_name)
    .filter(Boolean)
    .join(", ");
  const [hov, setHov] = useState(false);

  return (
    <div
      style={{
        ...T.card,
        borderColor: isLive
          ? "rgba(200,255,0,0.35)"
          : hov
            ? "rgba(200,255,0,0.15)"
            : "rgba(200,255,0,0.07)",
        background: isLive
          ? "rgba(200,255,0,0.06)"
          : hov
            ? "rgba(200,255,0,0.03)"
            : "rgba(15,26,0,0.55)",
        backdropFilter: "blur(8px)",
        opacity: status === "completed" ? 0.6 : 1,
        transform: hov ? "translateY(-1px)" : "none",
        transition: "all .15s",
        cursor: "pointer",
      }}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {isLive && (
        <div style={T.liveBanner}>
          <span style={T.liveDot} />
          <span style={T.liveText}>
            {t.live_matches_count} match{t.live_matches_count !== 1 ? "es" : ""}{" "}
            live now
          </span>
        </div>
      )}
      <h2 style={T.cardTitle}>{t.name}</h2>
      <p style={T.cardMeta}>
        {formatDateRange(t.start_date, t.end_date)}
        {venues ? ` · ${venues}` : ""}
      </p>
      <div style={T.pillRow}>
        {status === "active" && !isLive && (
          <span style={{ ...T.pill, ...T.pillGreen }}>In Progress</span>
        )}
        {status === "upcoming" && (
          <span style={{ ...T.pill, ...T.pillBlue }}>Upcoming</span>
        )}
        {status === "completed" && (
          <span style={{ ...T.pill, ...T.pillGray }}>Completed</span>
        )}
        {t.matches_count > 0 && (
          <span style={{ ...T.pill, ...T.pillGray }}>
            {t.matches_count} matches
          </span>
        )}
        {(t.sponsors || []).length > 0 && (
          <span style={{ ...T.pill, ...T.pillGray }}>
            {t.sponsors.length} sponsors
          </span>
        )}
      </div>
      <span style={T.chevron}>›</span>
    </div>
  );
}

export default function TournamentList() {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/tournaments/?ordering=-start_date`,
        );
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        const d = await res.json();
        if (!cancelled)
          setTournaments(Array.isArray(d) ? d : (d.results ?? []));
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const filtered = useMemo(
    () =>
      tournaments
        .filter((t) => {
          const e = new Date(t.end_date);
          e.setHours(23, 59, 59, 999);
          return e >= cutoff;
        })
        .filter(
          (t) =>
            !search.trim() ||
            t.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .filter(
          (t) =>
            filter === "all" || getStatus(t.start_date, t.end_date) === filter,
        ),
    [tournaments, search, filter, cutoff],
  );

  const counts = useMemo(() => {
    const base = tournaments.filter((t) => {
      const e = new Date(t.end_date);
      e.setHours(23, 59, 59, 999);
      return e >= cutoff;
    });
    return {
      all: base.length,
      active: base.filter(
        (t) => getStatus(t.start_date, t.end_date) === "active",
      ).length,
      upcoming: base.filter(
        (t) => getStatus(t.start_date, t.end_date) === "upcoming",
      ).length,
      completed: base.filter(
        (t) => getStatus(t.start_date, t.end_date) === "completed",
      ).length,
    };
  }, [tournaments, cutoff]);

  return (
    <SpectatorLayout title="Tournaments">
      <div style={T.page}>
        {/* Heading */}
        <div style={T.headingWrap}>
          <h1 style={T.h1}>Tournaments</h1>
          <p style={T.sub}>Live scores, schedules &amp; brackets</p>
        </div>

        {/* Search */}
        <div style={T.searchRow}>
          <div style={T.searchWrap}>
            <span style={T.searchIcon}>🔍</span>
            <input
              style={T.searchInput}
              type="text"
              placeholder="Search tournaments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button style={T.clearBtn} onClick={() => setSearch("")}>
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div style={T.tabs} className="scroll-row">
          {[
            { key: "all", label: "All" },
            { key: "active", label: "Active" },
            { key: "upcoming", label: "Upcoming" },
            { key: "completed", label: "Recent" },
          ].map(({ key, label }) => (
            <button
              key={key}
              style={{ ...T.tab, ...(filter === key ? T.tabActive : {}) }}
              onClick={() => setFilter(key)}
            >
              {label}
              {counts[key] > 0 && (
                <span
                  style={{
                    ...T.tabBadge,
                    background:
                      filter === key ? "#c8ff00" : "rgba(200,255,0,0.08)",
                    color: filter === key ? "#0a0a0a" : "rgba(200,255,0,0.5)",
                  }}
                >
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={T.list}>
          {loading && [1, 2, 3].map((i) => <SkeletonCard key={i} />)}

          {!loading && error && (
            <div style={T.errorBox}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div>
                <p style={{ fontWeight: 600, color: "#f87171" }}>
                  Could not load tournaments
                </p>
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
              <button
                style={T.accentBtn}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={T.emptyBox}>
              <span style={{ fontSize: 36, marginBottom: 12 }}>🏸</span>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>
                {search ? `No results for "${search}"` : "No tournaments found"}
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
                {search ? "Try a different name." : "Check back soon."}
              </p>
              {search && (
                <button
                  style={{ ...T.accentBtn, marginTop: 16 }}
                  onClick={() => setSearch("")}
                >
                  Clear search
                </button>
              )}
            </div>
          )}

          {!loading &&
            !error &&
            filtered.map((t) => (
              <TournamentCard
                key={t.id}
                t={t}
                onClick={() => navigate(`/spectator/tournament/${t.id}`)}
              />
            ))}
        </div>

        {!loading && !error && (
          <p style={T.footerNote}>
            Showing tournaments from the last 7 days and onwards
          </p>
        )}
      </div>
    </SpectatorLayout>
  );
}

const T = {
  page: { padding: "0 0 60px" },
  headingWrap: { padding: "32px 20px 0" },
  h1: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 34,
    color: "#c8ff00",
    letterSpacing: "-0.5px",
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: "rgba(200,255,0,0.4)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
  },
  searchRow: { padding: "18px 20px 0" },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(15,26,0,0.6)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 12,
    padding: "0 14px",
    backdropFilter: "blur(8px)",
  },
  searchIcon: { fontSize: 14, color: "rgba(200,255,0,0.3)", flexShrink: 0 },
  searchInput: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 14,
    color: "#fff",
    padding: "12px 0",
    background: "transparent",
  },
  clearBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    color: "rgba(200,255,0,0.3)",
    padding: "4px",
  },
  tabs: { display: "flex", gap: 6, padding: "14px 20px 0", overflowX: "auto" },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 20,
    border: "1px solid rgba(200,255,0,0.1)",
    background: "rgba(15,26,0,0.4)",
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(200,255,0,0.4)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all .15s",
    flexShrink: 0,
  },
  tabActive: {
    background: "rgba(200,255,0,0.12)",
    borderColor: "rgba(200,255,0,0.35)",
    color: "#c8ff00",
  },
  tabBadge: {
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 10,
    lineHeight: 1.6,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "14px 20px 0",
  },
  card: {
    position: "relative",
    border: "1px solid rgba(200,255,0,0.07)",
    borderRadius: 14,
    padding: "16px 40px 16px 18px",
  },
  liveBanner: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  liveDot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#c8ff00",
    animation: "pulse 1.5s infinite",
    flexShrink: 0,
  },
  liveText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#c8ff00",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  cardTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 18,
    color: "#fff",
    marginBottom: 4,
  },
  cardMeta: { fontSize: 12, color: "rgba(200,255,0,0.35)", marginBottom: 10 },
  pillRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  pill: {
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
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.3)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  chevron: {
    position: "absolute",
    right: 16,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 20,
    color: "rgba(200,255,0,0.2)",
    fontWeight: 300,
  },
  errorBox: {
    background: "rgba(255,100,100,0.06)",
    border: "1px solid rgba(255,100,100,0.2)",
    borderRadius: 12,
    padding: "16px",
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
  },
  emptyBox: {
    background: "rgba(15,26,0,0.5)",
    border: "1px solid rgba(200,255,0,0.08)",
    borderRadius: 14,
    padding: "40px 20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "rgba(255,255,255,0.6)",
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
  footerNote: {
    textAlign: "center",
    fontSize: 11,
    color: "rgba(200,255,0,0.2)",
    marginTop: 20,
    padding: "0 20px",
  },
};
