import { useApi } from "../hooks/useApi";

function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{ ...S.card, borderColor: accent ? `${accent}33` : "rgba(255,255,255,0.06)" }}>
      <div style={{ ...S.cardAccent, background: accent || "#c8ff00" }} />
      <div style={S.cardValue}>{value ?? "—"}</div>
      <div style={S.cardLabel}>{label}</div>
      {sub && <div style={S.cardSub}>{sub}</div>}
    </div>
  );
}

function MatchRow({ m }) {
  const status = m.status ?? "Upcoming";
  const clr = { Live: "#c8ff00", Completed: "#888", Upcoming: "#4af" }[status] || "#888";
  const t1 = [m.player1_team1_name, m.player2_team1_name].filter(Boolean).join(" / ");
  const t2 = [m.player1_team2_name, m.player2_team2_name].filter(Boolean).join(" / ");
  return (
    <div style={S.matchRow}>
      <div style={{ ...S.pill, background: `${clr}22`, color: clr }}>{status}</div>
      <div style={S.matchTeams}>
        <span style={S.teamName}>{t1 || "TBD"}</span>
        <span style={S.vs}>vs</span>
        <span style={S.teamName}>{t2 || "TBD"}</span>
      </div>
      <div style={S.matchMeta}>{m.court_name || m.venue_name || ""}</div>
      <div style={S.matchMeta}>{m.tournament_name}</div>
      {m.umpire_pin && (
        <div style={S.pinChip}>PIN: <strong>{m.umpire_pin}</strong></div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: tournaments } = useApi("/api/tournaments/");
  const { data: matches }     = useApi("/api/matches/");
  const { data: players }     = useApi("/api/players/");
  const { data: live }        = useApi("/api/matches/live/");
  const { data: today }       = useApi("/api/matches/today/");

  const liveArr    = Array.isArray(live)  ? live  : [];
  const todayArr   = Array.isArray(today) ? today : [];
  const matchArr   = Array.isArray(matches) ? matches : [];
  const completed  = matchArr.filter(m => m.status === "Completed").length;

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.head}>
        <div>
          <div style={S.title}>Dashboard</div>
          <div style={S.sub}>Tournament overview — {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}</div>
        </div>
      </div>

      <div style={S.stats}>
        <StatCard label="Tournaments"   value={tournaments?.length}  accent="#c8ff00" />
        <StatCard label="Total matches" value={matchArr.length}       accent="#4af" />
        <StatCard label="Live now"      value={liveArr.length}        accent="#ff4444" sub={liveArr.length ? "● On court" : "No live matches"} />
        <StatCard label="Players"       value={players?.length}       accent="#b48fff" />
        <StatCard label="Completed"     value={completed}             accent="#888" />
      </div>

      <div style={S.sections}>
        <div style={S.section}>
          <div style={S.sectionHead}>
            <div style={S.sectionTitle}>Live matches</div>
            {liveArr.length > 0 && <div style={S.liveOrb} />}
          </div>
          {liveArr.length === 0
            ? <div style={S.empty}>No matches in progress right now.</div>
            : liveArr.map(m => <MatchRow key={m.id} m={m} />)
          }
        </div>

        <div style={S.section}>
          <div style={S.sectionHead}>
            <div style={S.sectionTitle}>Today's schedule</div>
            <div style={S.sectionCount}>{todayArr.length} matches</div>
          </div>
          {todayArr.length === 0
            ? <div style={S.empty}>No matches scheduled for today.</div>
            : todayArr.map(m => <MatchRow key={m.id} m={m} />)
          }
        </div>
      </div>
    </div>
  );
}

const CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const S = {
  page:  { display: "flex", flexDirection: "column", gap: 32 },
  head:  { display: "flex", alignItems: "flex-start", justifyContent: "space-between" },
  title: { fontFamily: "'DM Serif Display', serif", fontSize: 34, color: "#fff", lineHeight: 1 },
  sub:   { fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6 },
  stats: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 },
  card: {
    background: "#111", border: "1px solid", borderRadius: 14,
    padding: "22px 20px 18px", position: "relative", overflow: "hidden",
  },
  cardAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2 },
  cardValue:  { fontFamily: "'DM Serif Display', serif", fontSize: 40, color: "#fff", lineHeight: 1 },
  cardLabel:  { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 8, textTransform: "uppercase", letterSpacing: "1px" },
  cardSub:    { fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 4 },
  sections:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  section:    { background: "#111", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 12 },
  sectionHead: { display: "flex", alignItems: "center", gap: 10, marginBottom: 4 },
  sectionTitle:{ fontSize: 16, color: "#fff", fontWeight: 600 },
  sectionCount: { fontSize: 12, color: "rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.06)", borderRadius: 20, padding: "2px 10px" },
  liveOrb:    { width: 8, height: 8, borderRadius: "50%", background: "#ff4444", boxShadow: "0 0 8px #ff4444" },
  empty:      { color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "12px 0" },
  matchRow:   { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", flexWrap: "wrap" },
  pill:       { borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, flexShrink: 0 },
  matchTeams: { flex: 1, display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  teamName:   { fontSize: 13, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  vs:         { fontSize: 11, color: "rgba(255,255,255,0.25)", flexShrink: 0 },
  matchMeta:  { fontSize: 11, color: "rgba(255,255,255,0.3)", whiteSpace: "nowrap" },
  pinChip:    { fontSize: 11, color: "#c8ff00", background: "rgba(200,255,0,0.1)", borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" },
};
