// ════════════════════════════════════════════════════════════════════════════
// src/components/spectator/BracketTree.jsx
// ════════════════════════════════════════════════════════════════════════════
// export function groupByRound(bms) {
//   return bms.reduce((acc, bm) => {
//     if (!acc[bm.round_number]) acc[bm.round_number] = [];
//     acc[bm.round_number].push(bm);
//     return acc;
//   }, {});
// }
// export function roundName(roundNum, totalRounds) {
//   const fromEnd = totalRounds - roundNum + 1;
//   return (
//     {
//       1: "Final",
//       2: "Semi-Final",
//       3: "Quarter-Final",
//       4: "Round of 16",
//       5: "Round of 32",
//     }[fromEnd] || `Round ${roundNum}`
//   );
// }

import { groupByRound, roundName } from "../../utils/bracketUtils";
function slotInvolvesPlayer(bm, name) {
  if (!name) return false;
  const q = name.toLowerCase();
  return [bm.entry1_name, bm.entry2_name]
    .filter((n) => n && n !== "TBD" && n !== "—")
    .some((n) => n.toLowerCase().includes(q));
}
function playerSide(bm, name) {
  if (!name) return null;
  const q = name.toLowerCase();
  if (bm.entry1_name?.toLowerCase().includes(q)) return 1;
  if (bm.entry2_name?.toLowerCase().includes(q)) return 2;
  return null;
}
function playerWon(bm, name) {
  if (!name || !bm.match_detail) return false;
  const side = playerSide(bm, name);
  if (!side) return false;
  const { team1_sets: t1, team2_sets: t2 } = bm.match_detail;
  return side === 1 ? t1 > t2 : t2 > t1;
}

function SlotCard({
  bm,
  //   totalRounds,
  highlightPlayer,
  liveScores,
  onPlayerSelect,
}) {
  const m = bm.match_detail;
  const isLive = m?.status === "Live";
  const isCompleted = m?.status === "Completed";
  const involves = slotInvolvesPlayer(bm, highlightPlayer);
  const side = playerSide(bm, highlightPlayer);
  const won = playerWon(bm, highlightPlayer);
  const liveScore = m ? liveScores?.[m.id] : null;
  const t1Sets = m?.team1_sets ?? null;
  const t2Sets = m?.team2_sets ?? null;
  const e1Won = isCompleted && t1Sets > t2Sets;
  const e2Won = isCompleted && t2Sets > t1Sets;
  const dimmed = highlightPlayer && !involves;

  let borderColor = "rgba(255,255,255,0.06)";
  if (highlightPlayer && involves) {
    if (isLive) borderColor = "rgba(100,180,255,0.5)";
    else if (isCompleted && won) borderColor = "rgba(200,255,0,0.4)";
    else if (isCompleted && !won && side) borderColor = "rgba(255,100,100,0.4)";
    else borderColor = "rgba(150,100,255,0.4)";
  } else if (isLive) borderColor = "rgba(200,255,0,0.25)";
  else if (isCompleted) borderColor = "rgba(255,255,255,0.04)";

  let bg = "rgba(255,255,255,0.02)";
  if (highlightPlayer && involves) {
    if (isLive) bg = "rgba(100,180,255,0.06)";
    else if (isCompleted && won) bg = "rgba(200,255,0,0.05)";
    else if (isCompleted && !won && side) bg = "rgba(255,100,100,0.05)";
    else bg = "rgba(150,100,255,0.05)";
  } else if (isLive) bg = "rgba(200,255,0,0.03)";

  const nameClick = (name, e) => {
    e.stopPropagation();
    if (name && name !== "TBD" && name !== "—" && onPlayerSelect)
      onPlayerSelect(name);
  };

  return (
    <div
      style={{
        ...B.card,
        borderColor,
        background: bg,
        opacity: dimmed ? 0.22 : 1,
        transition: "opacity .2s, border-color .2s",
      }}
    >
      {isLive && (
        <div style={B.liveRow}>
          <span style={B.liveDot} />
          <span style={B.liveText}>Live</span>
          {m?.court_name && <span style={B.courtTag}>{m.court_name}</span>}
        </div>
      )}
      {bm.is_bye && <div style={B.byeTag}>BYE</div>}
      {/* Entry 1 */}
      <div style={B.entryRow}>
        <button
          style={{
            ...B.entryName,
            ...(e1Won ? B.entryWon : isCompleted ? B.entryLost : {}),
          }}
          onClick={(e) => nameClick(bm.entry1_name, e)}
          disabled={!bm.entry1_name || bm.entry1_name === "TBD"}
        >
          {bm.entry1_name || "TBD"}
        </button>
        {isLive &&
          liveScore?.team1Score !== null &&
          liveScore?.team1Score !== undefined && (
            <span style={B.liveScore}>{liveScore.team1Score}</span>
          )}
        {isCompleted && t1Sets !== null && (
          <span style={{ ...B.setNum, ...(e1Won ? B.setWon : B.setLost) }}>
            {t1Sets}
          </span>
        )}
      </div>
      <div style={B.divider} />
      {/* Entry 2 */}
      {!bm.is_bye ? (
        <div style={B.entryRow}>
          <button
            style={{
              ...B.entryName,
              ...(e2Won ? B.entryWon : isCompleted ? B.entryLost : {}),
            }}
            onClick={(e) => nameClick(bm.entry2_name, e)}
            disabled={!bm.entry2_name || bm.entry2_name === "TBD"}
          >
            {bm.entry2_name || "TBD"}
          </button>
          {isLive &&
            liveScore?.team2Score !== null &&
            liveScore?.team2Score !== undefined && (
              <span style={B.liveScore}>{liveScore.team2Score}</span>
            )}
          {isCompleted && t2Sets !== null && (
            <span style={{ ...B.setNum, ...(e2Won ? B.setWon : B.setLost) }}>
              {t2Sets}
            </span>
          )}
        </div>
      ) : (
        <div style={{ ...B.entryRow, opacity: 0.2 }}>
          <span style={B.entryName}>—</span>
        </div>
      )}
      {m?.status === "Upcoming" && m?.scheduled_time && (
        <div style={B.schedTime}>
          {new Date(m.scheduled_time).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {m.court_name && ` · ${m.court_name}`}
        </div>
      )}
    </div>
  );
}

export default function BracketTree({
  bracketMatches = [],
  highlightPlayer = null,
  liveScores = {},
  onPlayerSelect,
}) {
  if (!bracketMatches.length) {
    return (
      <div style={B.empty}>
        <span style={{ fontSize: 32, marginBottom: 12 }}>🏆</span>
        <p style={{ fontWeight: 600, color: "#fff", marginBottom: 6 }}>
          Draw not yet available
        </p>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
          The bracket will appear once the director generates the draw.
        </p>
      </div>
    );
  }
  const rounds = groupByRound(bracketMatches);
  const roundNums = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);
  const totalRounds = roundNums.length;
  const finalBm = bracketMatches.find((b) => b.round_number === totalRounds);
  const champion = (() => {
    if (!finalBm?.match_detail || finalBm.match_detail.status !== "Completed")
      return null;
    return finalBm.match_detail.team1_sets > finalBm.match_detail.team2_sets
      ? finalBm.entry1_name
      : finalBm.entry2_name;
  })();

  return (
    <div style={{ overflowX: "auto", paddingBottom: 12 }}>
      <div style={B.bracket}>
        {roundNums.map((rnd) => {
          const slots = rounds[rnd]
            .slice()
            .sort((a, b) => a.position - b.position);
          return (
            <div key={rnd} style={B.roundCol}>
              <div style={B.roundHeader}>{roundName(rnd, totalRounds)}</div>
              <div
                style={{
                  ...B.roundSlots,
                  justifyContent:
                    slots.length === 1 ? "center" : "space-around",
                }}
              >
                {slots.map((bm) => (
                  <div key={bm.id} style={B.slotWrap}>
                    <SlotCard
                      bm={bm}
                      totalRounds={totalRounds}
                      highlightPlayer={highlightPlayer}
                      liveScores={liveScores}
                      onPlayerSelect={onPlayerSelect}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {/* Champion */}
        <div style={{ ...B.roundCol, minWidth: 120 }}>
          <div style={B.roundHeader}>Champion</div>
          <div style={{ ...B.roundSlots, justifyContent: "center" }}>
            <div style={B.championBox}>
              <span style={{ fontSize: 26 }}>{champion ? "🥇" : "🏆"}</span>
              <span style={B.championName}>{champion || "TBD"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const B = {
  bracket: { display: "flex", minWidth: "fit-content", padding: "0 4px" },
  roundCol: {
    display: "flex",
    flexDirection: "column",
    minWidth: 148,
    maxWidth: 175,
    flex: "0 0 auto",
  },
  roundHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(200,255,0,0.25)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    textAlign: "center",
    padding: "8px 4px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    marginBottom: 8,
    border: "rgba(200,255,0,0.06)",
  },
  roundSlots: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    padding: "0 6px",
    gap: 6,
  },
  slotWrap: { flex: 1, display: "flex", alignItems: "center", minHeight: 70 },
  card: {
    border: "1px solid rgba(200,255,0,0.07)",
    borderRadius: 10,
    padding: "8px 10px",
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(15,26,0,0.5)",
  },
  liveRow: { display: "flex", alignItems: "center", gap: 5, marginBottom: 5 },
  liveDot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#c8ff00",
    flexShrink: 0,
    animation: "pulse 1.5s infinite",
  },
  liveText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#c8ff00",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  courtTag: {
    fontSize: 9,
    color: "rgba(200,255,0,0.4)",
    background: "rgba(200,255,0,0.05)",
    borderRadius: 4,
    padding: "1px 5px",
  },
  byeTag: {
    fontSize: 9,
    fontWeight: 700,
    color: "rgba(200,255,0,0.6)",
    background: "rgba(200,255,0,0.06)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 4,
    padding: "1px 6px",
    display: "inline-block",
    marginBottom: 5,
  },
  entryRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    minHeight: 22,
  },
  entryName: {
    background: "none",
    border: "none",
    padding: "1px 2px",
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    borderRadius: 3,
  },
  entryWon: { color: "#c8ff00" },
  entryLost: { color: "rgba(255,255,255,0.2)", fontWeight: 400 },
  divider: { height: 1, background: "rgba(200,255,0,0.05)", margin: "4px 0" },
  setNum: {
    fontSize: 13,
    fontWeight: 700,
    flexShrink: 0,
    minWidth: 14,
    textAlign: "right",
  },
  setWon: { color: "#fff" },
  setLost: { color: "rgba(255,255,255,0.15)" },
  liveScore: {
    fontSize: 13,
    fontWeight: 700,
    color: "#c8ff00",
    flexShrink: 0,
    minWidth: 18,
    textAlign: "right",
  },
  schedTime: {
    fontSize: 10,
    color: "rgba(200,255,0,0.2)",
    marginTop: 5,
    paddingTop: 4,
    borderTop: "1px solid rgba(255,255,255,0.04)",
    border: "rgba(200,255,0,0.04)",
  },
  championBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "10px 8px",
    background: "rgba(15,26,0,0.5)",
    border: "1px solid rgba(200,255,0,0.08)",
    borderRadius: 10,
    width: "100%",
    textAlign: "center",
  },
  championName: { fontSize: 12, fontWeight: 700, color: "#c8ff00" },
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    textAlign: "center",
  },
};
