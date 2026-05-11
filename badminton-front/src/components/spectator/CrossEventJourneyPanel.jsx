// src/components/spectator/CrossEventJourneyPanel.jsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { buildPlayerJourney } from "../../utils/playerJourney";

const RES = {
  won: {
    border: "rgba(200,255,0,0.35)",
    bg: "rgba(200,255,0,0.04)",
    tag: { bg: "rgba(200,255,0,0.1)", color: "#c8ff00", text: "✓ Won" },
  },
  lost: {
    border: "rgba(255,100,100,0.3)",
    bg: "rgba(255,100,100,0.04)",
    tag: { bg: "rgba(255,100,100,0.1)", color: "#f87171", text: "✗ Lost" },
  },
  live: {
    border: "rgba(100,180,255,0.4)",
    bg: "rgba(100,180,255,0.05)",
    tag: { bg: "rgba(100,180,255,0.1)", color: "#60a5fa", text: "● Live" },
  },
  upcoming: {
    border: "rgba(255,255,255,0.06)",
    bg: "rgba(255,255,255,0.02)",
    tag: {
      bg: "rgba(255,255,255,0.05)",
      color: "rgba(255,255,255,0.35)",
      text: "Upcoming",
    },
  },
};

function MatchRow({ match, liveScores }) {
  const c = RES[match._result] || RES.upcoming;
  const liveScore = match.status === "Live" ? liveScores?.[match.id] : null;
  const myLive = liveScore
    ? match._side === 1
      ? liveScore.team1Score
      : liveScore.team2Score
    : null;
  const oppLive = liveScore
    ? match._side === 1
      ? liveScore.team2Score
      : liveScore.team1Score
    : null;

  return (
    <div
      style={{ ...CEJ.matchRow, borderLeftColor: c.border, background: c.bg }}
    >
      <div style={CEJ.matchTop}>
        <span style={{ ...CEJ.tag, background: c.tag.bg, color: c.tag.color }}>
          {c.tag.text}
        </span>
        {match._timeLabel && <span style={CEJ.time}>{match._timeLabel}</span>}
      </div>
      <div style={CEJ.oppRow}>
        <span style={CEJ.vs}>vs</span>
        <span style={CEJ.opp}>{match._opponent}</span>
      </div>
      {match._setsScore && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color:
              match._result === "won" ? "#c8ff00" : "rgba(255,255,255,0.3)",
            marginBottom: 3,
          }}
        >
          {match._setsScore} sets
        </div>
      )}
      {match._result === "live" && myLive !== null && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#60a5fa",
            marginBottom: 3,
          }}
        >
          Game {liveScore?.currentGame || "?"}: {myLive} – {oppLive}
        </div>
      )}
      {match.court_name && <span style={CEJ.courtTag}>{match.court_name}</span>}
    </div>
  );
}

function EventSection({
  eventName,
  matches,
  liveScores,
  tournamentId,
  events,
  navigate,
}) {
  const eventObj = events?.find((e) => e.name === eventName);
  const isKnockout = eventObj?.format === "KNOCKOUT";
  const won = matches.filter((m) => m._result === "won").length;
  const lost = matches.filter((m) => m._result === "lost").length;
  const live = matches.filter((m) => m._result === "live").length;

  return (
    <div style={CEJ.eventSection}>
      <div style={CEJ.eventHeader}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={CEJ.eventName}>{eventName}</span>
          {live > 0 && (
            <span
              style={{
                ...CEJ.miniPill,
                background: "rgba(100,180,255,0.1)",
                color: "#60a5fa",
              }}
            >
              {live} live
            </span>
          )}
          {won > 0 && (
            <span
              style={{
                ...CEJ.miniPill,
                background: "rgba(200,255,0,0.08)",
                color: "#c8ff00",
              }}
            >
              {won}W
            </span>
          )}
          {lost > 0 && (
            <span
              style={{
                ...CEJ.miniPill,
                background: "rgba(255,100,100,0.08)",
                color: "#f87171",
              }}
            >
              {lost}L
            </span>
          )}
        </div>
        {isKnockout && eventObj && (
          <button
            style={CEJ.bracketLink}
            onClick={() =>
              navigate(
                `/spectator/tournament/${tournamentId}/event/${eventObj.id}/bracket`,
              )
            }
          >
            View bracket →
          </button>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} liveScores={liveScores} />
        ))}
      </div>
    </div>
  );
}

export default function CrossEventJourneyPanel({
  playerName,
  matches,
  liveScores = {},
  onClose,
  tournamentId,
  events = [],
}) {
  const navigate = useNavigate();
  const journey = useMemo(
    () => buildPlayerJourney(matches, playerName),
    [matches, playerName],
  );
  const { stats, eventGroups, isStillPlaying, isEliminated } = journey;

  const statusBadge = isStillPlaying
    ? { text: "Still playing", bg: "rgba(200,255,0,0.1)", color: "#c8ff00" }
    : isEliminated
      ? {
          text: "Eliminated",
          bg: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.35)",
        }
      : stats.total === 0
        ? null
        : {
            text: "No upcoming matches",
            bg: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.35)",
          };

  return (
    <div style={CEJ.panel}>
      {/* Header */}
      <div style={CEJ.header}>
        <div>
          <div style={CEJ.playerName}>{playerName}</div>
          {statusBadge && (
            <span
              style={{
                ...CEJ.statusBadge,
                background: statusBadge.bg,
                color: statusBadge.color,
              }}
            >
              {statusBadge.text}
            </span>
          )}
        </div>
        <button style={CEJ.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Stats row */}
      {stats.total > 0 && (
        <div style={CEJ.statsRow}>
          {[
            { v: stats.total, l: "Matches", c: "#fff" },
            stats.won > 0 && { v: stats.won, l: "Won", c: "#c8ff00" },
            stats.lost > 0 && { v: stats.lost, l: "Lost", c: "#f87171" },
            stats.live > 0 && { v: stats.live, l: "Live", c: "#60a5fa" },
            stats.upcoming > 0 && {
              v: stats.upcoming,
              l: "Upcoming",
              c: "rgba(255,255,255,0.35)",
            },
            stats.winRate !== null && {
              v: `${stats.winRate}%`,
              l: "Win rate",
              c: "#a78bfa",
            },
          ]
            .filter(Boolean)
            .map(({ v, l, c }) => (
              <div key={l} style={CEJ.statCell}>
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: c,
                    lineHeight: 1,
                  }}
                >
                  {v}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.25)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {l}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Events */}
      <div style={CEJ.body}>
        {stats.total === 0 ? (
          <div style={CEJ.empty}>
            <span style={{ fontSize: 28 }}>🏸</span>
            <p
              style={{
                margin: "10px 0 4px",
                fontWeight: 600,
                fontSize: 14,
                color: "#fff",
              }}
            >
              No matches found
            </p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
              No scheduled or completed matches in this tournament.
            </p>
          </div>
        ) : (
          Object.keys(eventGroups).map((evName) => (
            <EventSection
              key={evName}
              eventName={evName}
              matches={eventGroups[evName]}
              liveScores={liveScores}
              tournamentId={tournamentId}
              events={events}
              navigate={navigate}
            />
          ))
        )}
      </div>
    </div>
  );
}

const CEJ = {
  panel: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    fontFamily: "'DM Sans',sans-serif",
    background: "rgba(8,16,0,0.96)",
    backdropFilter: "blur(20px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "18px 20px 12px",
    borderBottom: "1px solid rgba(200,255,0,0.06)",
    flexShrink: 0,
  },
  playerName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 5,
    letterSpacing: "-0.01em",
  },
  statusBadge: {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 20,
  },
  closeBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "none",
    borderRadius: "50%",
    width: 30,
    height: 30,
    cursor: "pointer",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  statsRow: {
    display: "flex",
    borderBottom: "1px solid rgba(200,255,0,0.06)",
    flexShrink: 0,
    overflowX: "auto",
  },
  statCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "10px 16px",
    borderRight: "1px solid rgba(200,255,0,0.04)",
    gap: 3,
    flexShrink: 0,
  },
  body: { overflowY: "auto", flex: 1, padding: "0 0 24px" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "36px 24px",
    textAlign: "center",
  },
  eventSection: {
    padding: "14px 20px 2px",
    borderBottom: "1px solid rgba(200,255,0,0.04)",
  },
  eventHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  eventName: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  miniPill: {
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 7px",
    borderRadius: 10,
  },
  bracketLink: {
    background: "rgba(200,255,0,0.05)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    color: "rgba(200,255,0,0.4)",
    cursor: "pointer",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  matchRow: {
    borderLeft: "3px solid rgba(200,255,0,0.08)",
    background: "rgba(15,26,0,0.4)",
    borderRadius: "0 10px 10px 0",
    padding: "10px 12px",
    marginBottom: 6,
  },
  matchTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 5,
    flexWrap: "wrap",
  },
  tag: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8 },
  time: { fontSize: 10, color: "rgba(255,255,255,0.2)" },
  oppRow: { display: "flex", alignItems: "baseline", gap: 5, marginBottom: 3 },
  vs: { fontSize: 11, color: "rgba(255,255,255,0.2)", flexShrink: 0 },
  opp: { fontSize: 14, fontWeight: 600, color: "#fff" },
  courtTag: {
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
    background: "rgba(200,255,0,0.05)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 5,
    padding: "1px 6px",
  },
};
