// src/pages/director/EventBracket.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByRound(bracketMatches) {
  return bracketMatches.reduce((acc, bm) => {
    const r = bm.round_number;
    if (!acc[r]) acc[r] = [];
    acc[r].push(bm);
    return acc;
  }, {});
}

function roundName(roundNum, totalRounds) {
  const fromEnd = totalRounds - roundNum + 1;
  const map = {
    1: "Final",
    2: "Semi-final",
    3: "Quarter-final",
    4: "Round of 16",
    5: "Round of 32",
  };
  return map[fromEnd] || `Round ${roundNum}`;
}

function rrStandings(entries, bracketMatches) {
  const stats = {};
  entries.forEach((e) => {
    stats[e.id] = {
      entry: e,
      played: 0,
      won: 0,
      lost: 0,
      pts: 0,
      setsFor: 0,
      setsAgainst: 0,
    };
  });
  bracketMatches.forEach((bm) => {
    const m = bm.match_detail;
    if (!m || m.status !== "Completed") return;
    const e1id = bm.entry1,
      e2id = bm.entry2;
    if (!e1id || !e2id) return;
    const s1 = stats[e1id],
      s2 = stats[e2id];
    if (!s1 || !s2) return;
    s1.played++;
    s2.played++;
    s1.setsFor += m.team1_sets;
    s1.setsAgainst += m.team2_sets;
    s2.setsFor += m.team2_sets;
    s2.setsAgainst += m.team1_sets;
    if (m.team1_sets > m.team2_sets) {
      s1.won++;
      s1.pts += 2;
      s2.lost++;
    } else {
      s2.won++;
      s2.pts += 2;
      s1.lost++;
    }
  });
  return Object.values(stats).sort(
    (a, b) =>
      b.pts - a.pts || b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst),
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ bm, isKnockout }) {
  const m = bm.match_detail;
  const isBye = bm.entry2_name === "BYE" || !bm.entry2;
  const isTbd = bm.entry1_name === "TBD" && bm.entry2_name === "TBD";
  const statusClr =
    { Live: "#c8ff00", Completed: "#888", Upcoming: "#4af" }[m?.status] ||
    "#4af";

  const t1won = m?.status === "Completed" && m.team1_sets > m.team2_sets;
  const t2won = m?.status === "Completed" && m.team2_sets > m.team1_sets;

  return (
    <div style={{ ...S.matchCard, ...(isTbd ? S.matchCardTbd : {}) }}>
      {/* Team 1 */}
      <div style={{ ...S.matchPlayer, ...(t1won ? S.matchPlayerWon : {}) }}>
        <span style={S.playerName}>
          {isBye ? bm.entry1_name : bm.entry1_name || "TBD"}
        </span>
        {m?.status === "Completed" && (
          <span style={S.setScore}>{m.team1_sets}</span>
        )}
      </div>
      {/* Team 2 */}
      <div
        style={{
          ...S.matchPlayer,
          ...(t2won ? S.matchPlayerWon : {}),
          borderBottom: "none",
        }}
      >
        <span style={S.playerName}>
          {isBye ? "BYE" : bm.entry2_name || "TBD"}
        </span>
        {m?.status === "Completed" && (
          <span style={S.setScore}>{m.team2_sets}</span>
        )}
      </div>
      {/* Status strip */}
      <div style={{ ...S.matchStatus, background: statusClr }}>
        {isBye ? "BYE" : isTbd ? "TBD" : m?.status || "Upcoming"}
      </div>
    </div>
  );
}

// ─── Knockout bracket ─────────────────────────────────────────────────────────

function KnockoutBracket({ bracketMatches }) {
  const rounds = groupByRound(bracketMatches);
  const roundNums = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);
  const totalRounds = roundNums.length;

  return (
    <div style={S.bracketScroll}>
      <div style={S.bracket}>
        {roundNums.map((rnd) => {
          const bms = rounds[rnd].sort((a, b) => a.position - b.position);
          return (
            <div key={rnd} style={S.roundCol}>
              <div style={S.roundHeader}>{roundName(rnd, totalRounds)}</div>
              <div
                style={{
                  ...S.roundMatches,
                  justifyContent:
                    totalRounds === 1 ? "flex-start" : "space-around",
                }}
              >
                {bms.map((bm) => (
                  <div key={bm.id} style={S.matchWrap}>
                    <MatchCard bm={bm} isKnockout />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {/* Champion column */}
        <div style={{ ...S.roundCol, minWidth: 130 }}>
          <div style={S.roundHeader}>Champion</div>
          <div
            style={{
              ...S.roundMatches,
              justifyContent: "center",
              alignItems: "flex-start",
              paddingTop: 40,
            }}
          >
            <div style={S.champion}>
              <div style={S.champLabel}>🥇 Winner</div>
              <div style={S.champName}>TBD</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Round Robin view ─────────────────────────────────────────────────────────

function RoundRobinView({ event, bracketMatches }) {
  const entries = event.entries || [];
  const standings = rrStandings(entries, bracketMatches);
  const scheduled = bracketMatches.filter(
    (bm) => bm.match_detail?.status !== "Completed",
  );
  const completed = bracketMatches.filter(
    (bm) => bm.match_detail?.status === "Completed",
  );

  return (
    <div>
      {/* Standings */}
      <div style={S.rrSection}>
        <div style={S.rrSectionLabel}>Standings</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>#</th>
              <th style={{ ...S.th, textAlign: "left" }}>Team / Player</th>
              <th style={S.th}>Played</th>
              <th style={S.th}>W</th>
              <th style={S.th}>L</th>
              <th style={S.th}>Sets +/-</th>
              <th style={S.th}>Pts</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row, idx) => (
              <tr key={row.entry.id} style={idx === 0 ? S.trWinner : {}}>
                <td style={S.td}>{idx + 1}</td>
                <td
                  style={{
                    ...S.td,
                    textAlign: "left",
                    fontWeight: idx === 0 ? 600 : 400,
                  }}
                >
                  {row.entry.display_name}
                  {idx === 0 && row.played > 0 && (
                    <span style={S.topBadge}>Leader</span>
                  )}
                </td>
                <td style={S.td}>{row.played}</td>
                <td style={{ ...S.td, color: "#c8ff00" }}>{row.won}</td>
                <td style={{ ...S.td, color: "#ff6b6b" }}>{row.lost}</td>
                <td style={S.td}>
                  {row.setsFor}/{row.setsAgainst}
                </td>
                <td style={{ ...S.td, fontWeight: 600 }}>{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Match schedule */}
      <div style={S.rrSection}>
        <div style={S.rrSectionLabel}>
          All matches ({bracketMatches.length} total)
        </div>
        <div style={S.rrMatchGrid}>
          {bracketMatches
            .sort((a, b) => a.position - b.position)
            .map((bm) => (
              <MatchCard key={bm.id} bm={bm} />
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EventBracket() {
  const { id } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/events/${id}/bracket/`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bracket.");
      setEvent(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <div style={S.loading}>Loading bracket…</div>;
  if (error) return <div style={S.errBox}>{error}</div>;
  if (!event) return null;

  const isKnockout = event.format === "KNOCKOUT";
  const bms = event.bracket_matches || [];
  const totalMatches = bms.length;
  const played = bms.filter(
    (bm) => bm.match_detail?.status === "Completed",
  ).length;

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={S.header}>
        <button style={S.back} onClick={() => navigate("/director/events")}>
          ← Events
        </button>
        <div>
          <div style={S.title}>{event.name}</div>
          <div style={S.sub}>
            {event.tournament_name} ·{" "}
            {event.format === "KNOCKOUT" ? "Knockout" : "Round Robin"} ·{" "}
            {event.entry_count} entries
          </div>
        </div>
        <div style={S.progress}>
          <div style={S.progressBar}>
            <div
              style={{
                ...S.progressFill,
                width: totalMatches
                  ? `${(played / totalMatches) * 100}%`
                  : "0%",
              }}
            />
          </div>
          <div style={S.progressText}>
            {played}/{totalMatches} matches played
          </div>
        </div>
      </div>

      {/* Bracket view */}
      {!event.is_drawn ? (
        <div style={S.notDrawn}>
          Bracket has not been generated yet. Go back to Events and generate the
          bracket.
        </div>
      ) : isKnockout ? (
        <KnockoutBracket bracketMatches={bms} />
      ) : (
        <RoundRobinView event={event} bracketMatches={bms} />
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  ::-webkit-scrollbar { height: 4px; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
`;

const S = {
  page: { fontFamily: "'DM Sans', sans-serif", color: "#fff" },
  loading: { color: "rgba(255,255,255,0.4)", padding: "40px 0" },
  errBox: {
    background: "rgba(255,80,80,0.1)",
    border: "1px solid rgba(255,80,80,0.2)",
    borderRadius: 8,
    padding: "14px 18px",
    color: "#ff8080",
    fontSize: 13,
  },
  notDrawn: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    padding: "40px 0",
  },

  // Header
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 20,
    marginBottom: 28,
    flexWrap: "wrap",
  },
  back: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "8px 14px",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 4,
  },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 28,
    color: "#fff",
    flex: 1,
  },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 3 },
  progress: { marginLeft: "auto", textAlign: "right" },
  progressBar: {
    width: 160,
    height: 4,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    marginBottom: 4,
    marginLeft: "auto",
  },
  progressFill: {
    height: "100%",
    background: "#c8ff00",
    borderRadius: 2,
    transition: "width .4s",
  },
  progressText: { fontSize: 11, color: "rgba(255,255,255,0.35)" },

  // Bracket layout
  bracketScroll: { overflowX: "auto", paddingBottom: 12 },
  bracket: {
    display: "flex",
    gap: 0,
    alignItems: "stretch",
    minWidth: "max-content",
  },
  roundCol: {
    display: "flex",
    flexDirection: "column",
    minWidth: 190,
    paddingRight: 8,
  },
  roundHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    padding: "0 4px 14px",
  },
  roundMatches: { display: "flex", flexDirection: "column", flex: 1 },
  matchWrap: {
    padding: "4px 0",
    flex: 1,
    display: "flex",
    alignItems: "center",
  },

  // Match card
  matchCard: {
    width: 178,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    background: "#111",
    overflow: "hidden",
    position: "relative",
  },
  matchCardTbd: { opacity: 0.5 },
  matchPlayer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "7px 10px",
    fontSize: 12,
    gap: 6,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  matchPlayerWon: { background: "rgba(200,255,0,0.06)", color: "#c8ff00" },
  playerName: {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  setScore: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    minWidth: 14,
    textAlign: "right",
  },
  matchStatus: {
    position: "absolute",
    top: 0,
    right: 0,
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: "0 8px 0 6px",
    color: "#000",
    letterSpacing: "0.5px",
  },
  champion: {
    background: "rgba(200,255,0,0.08)",
    border: "1px solid rgba(200,255,0,0.25)",
    borderRadius: 10,
    padding: "14px 16px",
  },
  champLabel: { fontSize: 11, color: "rgba(200,255,0,0.6)", marginBottom: 4 },
  champName: { fontSize: 14, fontWeight: 600, color: "#c8ff00" },

  // Round Robin
  rrSection: { marginBottom: 28 },
  rrSectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 12,
  },
  rrMatchGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
    gap: 8,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "8px 12px",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  td: {
    padding: "10px 12px",
    textAlign: "center",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  trWinner: { background: "rgba(200,255,0,0.04)" },
  topBadge: {
    fontSize: 10,
    background: "rgba(200,255,0,0.15)",
    color: "#c8ff00",
    borderRadius: 10,
    padding: "1px 8px",
    marginLeft: 8,
  },
};
