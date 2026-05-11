// src/components/spectator/MatchCard.jsx

export default function MatchCard({ match, liveScore = null, onPlayerSelect }) {
  const isLive = match.status === "Live";
  const isCompleted = match.status === "Completed";

  const team1Name = [match.player1_team1_name, match.player2_team1_name]
    .filter(Boolean)
    .join(" / ");
  const team2Name = [match.player1_team2_name, match.player2_team2_name]
    .filter(Boolean)
    .join(" / ");

  const scheduledLabel = match.scheduled_time
    ? new Date(match.scheduled_time).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  let winnerLabel = null;
  if (isCompleted) {
    if (match.team1_sets > match.team2_sets) winnerLabel = team1Name;
    else if (match.team2_sets > match.team1_sets) winnerLabel = team2Name;
  }

  const t1Sets = isLive && liveScore ? liveScore.team1Sets : match.team1_sets;
  const t2Sets = isLive && liveScore ? liveScore.team2Sets : match.team2_sets;
  const t1Score = isLive && liveScore ? liveScore.team1Score : null;
  const t2Score = isLive && liveScore ? liveScore.team2Score : null;

  const borderColor = isLive
    ? "rgba(200,255,0,0.35)"
    : isCompleted
      ? "rgba(200,255,0,0.05)"
      : "rgba(200,255,0,0.08)";

  const bg = isLive ? "rgba(200,255,0,0.06)" : "rgba(15,26,0,0.5)";

  const nameClick = (name, e) => {
    e.stopPropagation();
    if (name && onPlayerSelect) onPlayerSelect(name);
  };

  const NameBtn = ({ name, winner }) => (
    <button
      style={{ ...MC.name, ...(winner ? MC.nameWin : {}) }}
      onClick={(e) => nameClick(name, e)}
      disabled={!name}
    >
      {name || "TBD"}
    </button>
  );

  return (
    <div
      style={{
        ...MC.card,
        borderColor,
        background: bg,
        backdropFilter: "blur(6px)",
        opacity: isCompleted ? 0.8 : 1,
      }}
    >
      {/* Top row */}
      <div style={MC.topRow}>
        <div style={MC.topLeft}>
          {isLive && (
            <span style={MC.liveChip}>
              <span style={MC.liveDot} /> Live
            </span>
          )}
          {match.event_name && (
            <span style={MC.eventLabel}>{match.event_name}</span>
          )}
        </div>
        <div style={MC.topRight}>
          {match.court_name && (
            <span style={MC.courtTag}>{match.court_name}</span>
          )}
          {scheduledLabel && !isLive && (
            <span style={MC.timeLabel}>{scheduledLabel}</span>
          )}
        </div>
      </div>

      {/* Players + score */}
      <div style={MC.matchRow}>
        <div style={MC.teamBlock}>
          <div style={MC.teamNames}>
            <NameBtn
              name={match.player1_team1_name}
              winner={winnerLabel === team1Name}
            />
            {match.player2_team1_name && (
              <>
                <span style={MC.slash}>/</span>
                <NameBtn
                  name={match.player2_team1_name}
                  winner={winnerLabel === team1Name}
                />
              </>
            )}
          </div>
          {winnerLabel === team1Name && <span style={MC.wonBadge}>Won</span>}
        </div>

        <div style={MC.scoreCol}>
          <div style={MC.setsRow}>
            <span
              style={{ ...MC.setNum, ...(t1Sets > t2Sets ? MC.setNumWin : {}) }}
            >
              {t1Sets}
            </span>
            <span style={MC.setDash}>–</span>
            <span
              style={{ ...MC.setNum, ...(t2Sets > t1Sets ? MC.setNumWin : {}) }}
            >
              {t2Sets}
            </span>
          </div>
          {isLive && t1Score !== null && (
            <div style={MC.liveRow}>
              <span style={MC.liveScoreNum}>{t1Score}</span>
              <span style={MC.liveScoreSep}>·</span>
              <span style={MC.liveScoreNum}>{t2Score}</span>
            </div>
          )}
          {isLive && liveScore?.currentGame && (
            <div style={MC.gameLabel}>Game {liveScore.currentGame}</div>
          )}
        </div>

        <div style={{ ...MC.teamBlock, alignItems: "flex-end" }}>
          <div style={{ ...MC.teamNames, justifyContent: "flex-end" }}>
            <NameBtn
              name={match.player1_team2_name}
              winner={winnerLabel === team2Name}
            />
            {match.player2_team2_name && (
              <>
                <span style={MC.slash}>/</span>
                <NameBtn
                  name={match.player2_team2_name}
                  winner={winnerLabel === team2Name}
                />
              </>
            )}
          </div>
          {winnerLabel === team2Name && <span style={MC.wonBadge}>Won</span>}
        </div>
      </div>

      {/* Match type */}
      {match.match_type && (
        <div style={MC.bottomRow}>
          <span style={MC.typeBadge}>
            {{
              SINGLE: "Singles",
              DOUBLES: "Doubles",
              MIXED_DOUBLES: "Mixed Doubles",
            }[match.match_type] || match.match_type}
          </span>
        </div>
      )}
    </div>
  );
}

const MC = {
  card: {
    border: "1px solid rgba(200,255,0,0.08)",
    borderRadius: 12,
    padding: "12px 14px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
    flexWrap: "wrap",
  },
  topLeft: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  topRight: { display: "flex", alignItems: "center", gap: 6 },
  liveChip: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 700,
    color: "#c8ff00",
    background: "rgba(200,255,0,0.1)",
    border: "1px solid rgba(200,255,0,0.25)",
    borderRadius: 20,
    padding: "2px 9px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
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
  eventLabel: { fontSize: 11, color: "rgba(200,255,0,0.4)", fontWeight: 500 },
  courtTag: {
    fontSize: 11,
    color: "rgba(200,255,0,0.5)",
    background: "rgba(200,255,0,0.06)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 6,
    padding: "2px 8px",
    fontWeight: 500,
  },
  timeLabel: { fontSize: 11, color: "rgba(200,255,0,0.3)" },
  matchRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 10,
  },
  teamBlock: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 },
  teamNames: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
    alignItems: "center",
  },
  name: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    padding: "1px 3px",
    borderRadius: 4,
    fontFamily: "inherit",
    textAlign: "left",
    transition: "color .1s",
  },
  nameWin: { color: "#c8ff00" },
  slash: { fontSize: 11, color: "rgba(200,255,0,0.2)" },
  wonBadge: {
    fontSize: 10,
    fontWeight: 700,
    color: "#c8ff00",
    background: "rgba(200,255,0,0.1)",
    border: "1px solid rgba(200,255,0,0.2)",
    borderRadius: 10,
    padding: "1px 7px",
    alignSelf: "flex-start",
  },
  scoreCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    minWidth: 60,
  },
  setsRow: { display: "flex", alignItems: "center", gap: 4 },
  setNum: {
    fontSize: 22,
    fontWeight: 700,
    color: "rgba(200,255,0,0.2)",
    lineHeight: 1,
    minWidth: 18,
    textAlign: "center",
  },
  setNumWin: { color: "#fff" },
  setDash: { fontSize: 18, color: "rgba(200,255,0,0.1)", fontWeight: 300 },
  liveRow: { display: "flex", alignItems: "center", gap: 4 },
  liveScoreNum: { fontSize: 15, fontWeight: 700, color: "#c8ff00" },
  liveScoreSep: { fontSize: 12, color: "rgba(200,255,0,0.2)" },
  gameLabel: { fontSize: 10, color: "rgba(200,255,0,0.35)", fontWeight: 500 },
  bottomRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTop: "1px solid rgba(200,255,0,0.05)",
    display: "flex",
    gap: 6,
  },
  typeBadge: {
    fontSize: 10,
    color: "rgba(200,255,0,0.25)",
    background: "rgba(200,255,0,0.04)",
    borderRadius: 6,
    padding: "2px 7px",
  },
};
