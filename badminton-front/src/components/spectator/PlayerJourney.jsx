// ════════════════════════════════════════════════════════════════════════════
// src/components/spectator/PlayerJourney.jsx
// ════════════════════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { roundName } from "../../utils/bracketUtils";

export default function PlayerJourney({
  bracketMatches,
  playerName,
  liveScores,
  onClose,
}) {
  const journey = useMemo(() => {
    if (!playerName || !bracketMatches?.length) return [];
    const q = playerName.toLowerCase();
    const totalRounds = Math.max(...bracketMatches.map((b) => b.round_number));
    return bracketMatches
      .filter(
        (bm) =>
          !bm.is_bye &&
          (bm.entry1_name?.toLowerCase().includes(q) ||
            bm.entry2_name?.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.round_number - b.round_number)
      .map((bm) => {
        const m = bm.match_detail;
        const isE1 = bm.entry1_name?.toLowerCase().includes(q);
        const liveScore = m ? liveScores?.[m.id] : null;
        const myScore = isE1 ? m?.team1_sets : m?.team2_sets;
        const oppScore = isE1 ? m?.team2_sets : m?.team1_sets;
        const won = m?.status === "Completed" && myScore > oppScore;
        const lost = m?.status === "Completed" && myScore < oppScore;
        return {
          bm,
          roundLabel: roundName(bm.round_number, totalRounds),
          opponent: (isE1 ? bm.entry2_name : bm.entry1_name) || "TBD",
          myScore,
          oppScore,
          myLive:
            m?.status === "Live" && liveScore
              ? isE1
                ? liveScore.team1Score
                : liveScore.team2Score
              : null,
          oppLive:
            m?.status === "Live" && liveScore
              ? isE1
                ? liveScore.team2Score
                : liveScore.team1Score
              : null,
          won,
          lost,
          isLive: m?.status === "Live",
          isUpcoming: m?.status === "Upcoming" || !m,
          courtName: m?.court_name || null,
          timeLabel: m?.scheduled_time
            ? new Date(m.scheduled_time).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null,
          currentGame: liveScore?.currentGame || null,
        };
      });
  }, [bracketMatches, playerName, liveScores]);

  const won = journey.filter((j) => j.won).length;
  const lost = journey.filter((j) => j.lost).length;
  const isChampion =
    journey.length > 0 &&
    journey[journey.length - 1].won &&
    journey[journey.length - 1].bm.round_number ===
      Math.max(...(bracketMatches || []).map((b) => b.round_number));

  if (!playerName) return null;

  const RES_CLR = {
    live: {
      border: "rgba(100,180,255,0.5)",
      bg: "rgba(100,180,255,0.06)",
      tag: { bg: "rgba(100,180,255,0.1)", color: "#60a5fa", text: "● Live" },
    },
    won: {
      border: "rgba(200,255,0,0.4)",
      bg: "rgba(200,255,0,0.04)",
      tag: { bg: "rgba(200,255,0,0.1)", color: "#c8ff00", text: "✓ Won" },
    },
    lost: {
      border: "rgba(255,100,100,0.4)",
      bg: "rgba(255,100,100,0.04)",
      tag: { bg: "rgba(255,100,100,0.1)", color: "#f87171", text: "✗ Lost" },
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

  return (
    <div style={PJ.wrap}>
      <div style={PJ.header}>
        <div>
          <div style={PJ.name}>{playerName}</div>
          <div style={PJ.stats}>
            {journey.length} match{journey.length !== 1 ? "es" : ""}
            {won > 0 && <span style={{ color: "#c8ff00" }}> · {won}W</span>}
            {lost > 0 && <span style={{ color: "#f87171" }}> · {lost}L</span>}
            {isChampion && (
              <span style={{ color: "#c8ff00" }}> · 🥇 Champion</span>
            )}
          </div>
        </div>
        {onClose && (
          <button style={PJ.closeBtn} onClick={onClose}>
            ✕
          </button>
        )}
      </div>
      <div style={PJ.timeline}>
        {journey.length === 0 ? (
          <div style={PJ.empty}>No bracket matches found.</div>
        ) : (
          journey.map((j, i) => {
            const k = j.isLive
              ? "live"
              : j.won
                ? "won"
                : j.lost
                  ? "lost"
                  : "upcoming";
            const c = RES_CLR[k];
            return (
              <div
                key={j.bm.id}
                style={{
                  ...PJ.card,
                  borderLeftColor: c.border,
                  background: c.bg,
                }}
              >
                <div style={PJ.cardTop}>
                  <span style={PJ.roundLabel}>{j.roundLabel}</span>
                  <span
                    style={{
                      ...PJ.tag,
                      background: c.tag.bg,
                      color: c.tag.color,
                    }}
                  >
                    {c.tag.text}
                  </span>
                </div>
                <div style={PJ.opp}>
                  vs <strong style={{ color: "#fff" }}>{j.opponent}</strong>
                </div>
                {j.myScore !== null && j.myScore !== undefined && (
                  <div style={PJ.score}>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: j.won
                          ? "#c8ff00"
                          : j.lost
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {j.myScore}
                    </span>
                    <span
                      style={{ fontSize: 15, color: "rgba(255,255,255,0.1)" }}
                    >
                      –
                    </span>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: j.lost
                          ? "#c8ff00"
                          : j.won
                            ? "rgba(255,255,255,0.2)"
                            : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {j.oppScore}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.2)",
                        marginLeft: 3,
                      }}
                    >
                      sets
                    </span>
                  </div>
                )}
                {j.isLive && j.myLive !== null && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#60a5fa",
                      marginBottom: 3,
                    }}
                  >
                    Game {j.currentGame}: {j.myLive} – {j.oppLive}
                  </div>
                )}
                {(j.courtName || j.timeLabel) && (
                  <div style={PJ.meta}>
                    {j.courtName && <span>{j.courtName}</span>}
                    {j.timeLabel && <span>{j.timeLabel}</span>}
                  </div>
                )}
                {i < journey.length - 1 && j.won && (
                  <div style={PJ.connector}>↓ Advanced</div>
                )}
              </div>
            );
          })
        )}
        {isChampion && (
          <div style={PJ.championCard}>
            <span style={{ fontSize: 26 }}>🥇</span>
            <span style={PJ.champText}>Tournament Champion</span>
          </div>
        )}
      </div>
    </div>
  );
}

const PJ = {
  wrap: { fontFamily: "'DM Sans',sans-serif" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "16px 20px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  name: { fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 3 },
  stats: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  closeBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "none",
    borderRadius: "50%",
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  empty: {
    padding: "24px 20px",
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
  timeline: {
    padding: "12px 20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  card: {
    borderLeft: "3px solid rgba(255,255,255,0.06)",
    borderRadius: "0 10px 10px 0",
    padding: "10px 14px",
  },
  cardTop: { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 },
  roundLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tag: { fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 8 },
  opp: { fontSize: 14, color: "rgba(255,255,255,0.6)", marginBottom: 5 },
  score: { display: "flex", alignItems: "baseline", gap: 5, marginBottom: 4 },
  meta: {
    display: "flex",
    gap: 10,
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
    flexWrap: "wrap",
    marginTop: 3,
  },
  connector: {
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
    textAlign: "center",
    padding: "4px 0",
    marginTop: 4,
  },
  championCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "12px",
    background: "rgba(200,255,0,0.06)",
    border: "1px solid rgba(200,255,0,0.15)",
    borderRadius: 10,
    textAlign: "center",
    marginTop: 4,
  },
  champText: { fontSize: 13, fontWeight: 700, color: "#c8ff00" },
};
