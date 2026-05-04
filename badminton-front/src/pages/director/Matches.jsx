// src/pages/director/Matches.jsx

import { useState, useEffect, useCallback } from "react";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { useAuth } from "../../context/AuthContext";
import Modal, {
  FormField,
  Input,
  Select,
  SubmitBtn,
} from "../../components/Modal";

const STATUS_CLR = { Live: "#c8ff00", Completed: "#888", Upcoming: "#4af" };

const SCORING_FORMATS = [
  { value: "21_WITH_SET", label: "21 pts — settings to 30" },
  { value: "21_NO_SET", label: "21 pts — no settings" },
  { value: "15_WITH_SET", label: "15 pts — settings to 21" },
  { value: "15_NO_SET", label: "15 pts — no settings" },
];

// ─── Match row ────────────────────────────────────────────────────────────────

function MatchRow({ m, onEdit, onDelete }) {
  const t1 =
    [m.player1_team1_name, m.player2_team1_name].filter(Boolean).join(" / ") ||
    "TBD";
  const t2 =
    [m.player1_team2_name, m.player2_team2_name].filter(Boolean).join(" / ") ||
    "TBD";
  const clr = STATUS_CLR[m.status] || "#888";
  const time = m.scheduled_time
    ? new Date(m.scheduled_time).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <div style={S.row}>
      <div
        style={{
          ...S.statusDot,
          background: clr,
          boxShadow: m.status === "Live" ? `0 0 8px ${clr}` : "none",
        }}
      />
      <div style={S.rowTeams}>
        <span style={S.teamName}>{t1}</span>
        <span style={S.rowVs}>vs</span>
        <span style={S.teamName}>{t2}</span>
      </div>
      <div style={S.rowMeta}>
        {m.event_name ? (
          <span style={S.eventTag}>{m.event_name}</span>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
        )}
      </div>
      <div style={S.rowMeta}>{m.tournament_name}</div>
      <div style={S.rowMeta}>{m.match_type?.replace(/_/g, " ")}</div>
      <div style={S.rowMeta}>{m.court_name || m.venue_name || "—"}</div>
      <div style={S.rowMeta}>{time}</div>
      {m.umpire_pin && (
        <div style={S.pin}>
          PIN <strong>{m.umpire_pin}</strong>
        </div>
      )}
      <div style={S.rowActions}>
        <button style={S.editBtn} onClick={() => onEdit(m)}>
          Edit
        </button>
        <button style={S.delBtn} onClick={() => onDelete(m)}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Match form ───────────────────────────────────────────────────────────────

function MatchForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: tournaments } = useApi("/api/tournaments/");
  const { data: allPlayers } = useApi("/api/players/");
  const { data: venues } = useApi("/api/venues/");
  const { data: courts } = useApi("/api/courts/");
  const { data: allEvents } = useApi("/api/events/");

  const [form, setForm] = useState({
    tournament: initial?.tournament || "",
    event: initial?.event || "",
    match_type: initial?.match_type || "SINGLE",
    scoring_format: initial?.scoring_format || "21_WITH_SET",
    player1_team1: initial?.player1_team1 || "",
    player2_team1: initial?.player2_team1 || "",
    player1_team2: initial?.player1_team2 || "",
    player2_team2: initial?.player2_team2 || "",
    server: initial?.server || "",
    scheduled_time: initial?.scheduled_time
      ? initial.scheduled_time.slice(0, 16)
      : "",
    venue: initial?.venue || "",
    court: initial?.court || "",
    status: initial?.status || "Upcoming",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Registered players for the selected event ─────────────────────────────
  const [eventPlayers, setEventPlayers] = useState(null);
  const [loadingEventPlayers, setLoadingEventPlayers] = useState(false);
  const [playerSource, setPlayerSource] = useState("all");

  const loadEventPlayers = useCallback(
    async (eventId) => {
      if (!eventId) {
        setEventPlayers(null);
        setPlayerSource("all");
        return;
      }
      setLoadingEventPlayers(true);
      try {
        const res = await authFetch(
          `/api/event-registrations/players_for_event/?event=${eventId}`,
        );
        const data = await res.json();
        setEventPlayers(data.players || []);
        setPlayerSource(data.source || "all");
      } catch {
        setEventPlayers(null);
        setPlayerSource("all");
      } finally {
        setLoadingEventPlayers(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    loadEventPlayers(form.event);
  }, [form.event, loadEventPlayers]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleEventChange = (e) => {
    const eventId = e.target.value;
    const evArr = Array.isArray(allEvents) ? allEvents : [];
    const chosen = evArr.find((ev) => String(ev.id) === eventId);
    setForm((f) => ({
      ...f,
      event: eventId,
      match_type: chosen ? chosen.match_type : f.match_type,
      tournament: chosen ? String(chosen.tournament) : f.tournament,
      player1_team1: "",
      player2_team1: "",
      player1_team2: "",
      player2_team2: "",
      server: "",
    }));
  };

  const handleTournamentChange = (e) => {
    const tournId = e.target.value;
    const evArr = Array.isArray(allEvents) ? allEvents : [];
    const currentEvent = evArr.find((ev) => String(ev.id) === form.event);
    setForm((f) => ({
      ...f,
      tournament: tournId,
      event:
        currentEvent && String(currentEvent.tournament) === tournId
          ? f.event
          : "",
    }));
  };

  const isDoubles = form.match_type !== "SINGLE";
  const tournOpts = Array.isArray(tournaments) ? tournaments : [];
  const venueOpts = Array.isArray(venues) ? venues : [];
  const courtOpts = Array.isArray(courts) ? courts : [];
  const evArr = Array.isArray(allEvents) ? allEvents : [];

  const playerOpts =
    eventPlayers !== null
      ? eventPlayers
      : Array.isArray(allPlayers)
        ? allPlayers
        : [];

  const activePlayers = [
    form.player1_team1,
    form.player2_team1,
    form.player1_team2,
    form.player2_team2,
  ]
    .filter(Boolean)
    .map((id) => playerOpts.find((p) => String(p.id) === String(id)))
    .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const payload = {
      tournament: Number(form.tournament),
      match_type: form.match_type,
      scoring_format: form.scoring_format,
      player1_team1: Number(form.player1_team1),
      player1_team2: Number(form.player1_team2),
      scheduled_time: form.scheduled_time,
      status: form.status,
    };
    if (form.event) payload.event = Number(form.event);
    if (form.player2_team1) payload.player2_team1 = Number(form.player2_team1);
    if (form.player2_team2) payload.player2_team2 = Number(form.player2_team2);
    if (form.server) payload.server = Number(form.server);
    if (form.venue) payload.venue = Number(form.venue);
    if (form.court) payload.court = Number(form.court);

    try {
      const res = await authFetch(
        initial ? `/api/matches/${initial.id}/` : "/api/matches/",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(JSON.stringify(d));
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {error && <div style={S.errBox}>{error}</div>}

      {/* ── Event picker ── */}
      <div style={S.eventPickerBox}>
        <div style={S.eventPickerLabel}>Event category</div>
        <div style={S.eventPickerSub}>
          Selecting an event pre-fills the tournament, match type, and filters
          the player list.
        </div>
        <select
          style={S.eventSelect}
          value={form.event}
          onChange={handleEventChange}
        >
          <option value="">— No event / pick manually —</option>
          {tournOpts.map((t) => {
            const tEvents = evArr.filter(
              (ev) => String(ev.tournament) === String(t.id),
            );
            if (tEvents.length === 0) return null;
            return (
              <optgroup key={t.id} label={t.name}>
                {tEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} — {ev.match_type_display || ev.match_type}
                    {ev.round_label ? ` (${ev.round_label})` : ""}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* ── Player filter notice ── */}
      {form.event && (
        <div
          style={{
            ...S.filterNotice,
            background:
              playerSource === "registered"
                ? "rgba(200,255,0,0.06)"
                : "rgba(255,255,255,0.04)",
            borderColor:
              playerSource === "registered"
                ? "rgba(200,255,0,0.2)"
                : "rgba(255,255,255,0.08)",
          }}
        >
          {loadingEventPlayers ? (
            <span style={{ color: "rgba(255,255,255,0.4)" }}>
              Loading players…
            </span>
          ) : playerSource === "registered" ? (
            <>
              <span style={{ color: "#c8ff00", fontWeight: 600 }}>
                🎯 {playerOpts.length} registered players
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>
                — only these players appear below
              </span>
            </>
          ) : (
            <>
              <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                ⚠ No registered players
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 8 }}>
                — showing all {playerOpts.length} players
              </span>
            </>
          )}
        </div>
      )}

      <div style={S.divider} />

      {/* ── Tournament ── */}
      <FormField label="Tournament">
        <Select
          value={form.tournament}
          onChange={handleTournamentChange}
          required
        >
          <option value="">— Select —</option>
          {tournOpts.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </FormField>

      {/* ── Match type + Scoring format ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormField label="Match type">
          <Select value={form.match_type} onChange={set("match_type")}>
            <option value="SINGLE">Singles</option>
            <option value="DOUBLES">Doubles</option>
            <option value="MIXED_DOUBLES">Mixed Doubles</option>
          </Select>
        </FormField>

        <FormField label="Scoring format">
          <Select value={form.scoring_format} onChange={set("scoring_format")}>
            {SCORING_FORMATS.map((sf) => (
              <option key={sf.value} value={sf.value}>
                {sf.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {/* ── Teams ── */}
      <div style={S.teamGrid}>
        <div style={S.teamCol}>
          <div style={S.teamLabel}>Team 1</div>
          <FormField label="Player 1">
            <Select
              value={form.player1_team1}
              onChange={set("player1_team1")}
              required
            >
              <option value="">— Select —</option>
              {playerOpts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.country ? ` (${p.country})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          {isDoubles && (
            <FormField label="Player 2">
              <Select
                value={form.player2_team1}
                onChange={set("player2_team1")}
              >
                <option value="">— Select —</option>
                {playerOpts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.country ? ` (${p.country})` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>

        <div style={S.vsCol}>vs</div>

        <div style={S.teamCol}>
          <div style={S.teamLabel}>Team 2</div>
          <FormField label="Player 1">
            <Select
              value={form.player1_team2}
              onChange={set("player1_team2")}
              required
            >
              <option value="">— Select —</option>
              {playerOpts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.country ? ` (${p.country})` : ""}
                </option>
              ))}
            </Select>
          </FormField>
          {isDoubles && (
            <FormField label="Player 2">
              <Select
                value={form.player2_team2}
                onChange={set("player2_team2")}
              >
                <option value="">— Select —</option>
                {playerOpts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.country ? ` (${p.country})` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>
      </div>

      {/* ── Serving player ── */}
      <FormField label="Serving player (optional)">
        <Select value={form.server} onChange={set("server")}>
          <option value="">— Select —</option>
          {activePlayers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormField>

      <div style={S.divider} />

      {/* ── Venue + Court ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormField label="Venue">
          <Select value={form.venue} onChange={set("venue")}>
            <option value="">— Select —</option>
            {venueOpts.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Court">
          <Select value={form.court} onChange={set("court")}>
            <option value="">— Select —</option>
            {courtOpts
              .filter(
                (c) => !form.venue || String(c.venue) === String(form.venue),
              )
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </FormField>
      </div>

      {/* ── Time + Status ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormField label="Scheduled time">
          <Input
            type="datetime-local"
            value={form.scheduled_time}
            onChange={set("scheduled_time")}
            required
          />
        </FormField>
        <FormField label="Status">
          <Select value={form.status} onChange={set("status")}>
            <option value="Upcoming">Upcoming</option>
            <option value="Live">Live</option>
            <option value="Completed">Completed</option>
          </Select>
        </FormField>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <button type="button" style={S.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <SubmitBtn loading={saving}>
          {initial ? "Save changes" : "Create match"}
        </SubmitBtn>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Matches() {
  const { authFetch } = useAuth();
  const { data: matches, loading, refresh } = useApi("/api/matches/");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const matchArr = Array.isArray(matches) ? matches : [];

  const filtered = matchArr.filter((m) => {
    const text = [
      m.player1_team1_name,
      m.player2_team1_name,
      m.player1_team2_name,
      m.player2_team2_name,
      m.event_name,
      m.tournament_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      text.includes(search.toLowerCase()) &&
      (!filterStatus || m.status === filterStatus)
    );
  });

  const handleDelete = async (m) => {
    if (!confirm("Delete this match?")) return;
    await authFetch(`/api/matches/${m.id}/`, { method: "DELETE" });
    refresh();
  };

  const counts = {
    Live: matchArr.filter((m) => m.status === "Live").length,
    Upcoming: matchArr.filter((m) => m.status === "Upcoming").length,
    Completed: matchArr.filter((m) => m.status === "Completed").length,
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.topBar}>
        <div>
          <div style={S.title}>Matches</div>
          <div style={S.sub}>Create and manage tournament matches</div>
        </div>
        <button style={S.createBtn} onClick={() => setShowCreate(true)}>
          + New match
        </button>
      </div>

      {/* Stats */}
      <div style={S.statRow}>
        {[
          { label: "Total", value: matchArr.length, clr: "#fff" },
          { label: "Live", value: counts.Live, clr: "#c8ff00" },
          { label: "Upcoming", value: counts.Upcoming, clr: "#4af" },
          { label: "Completed", value: counts.Completed, clr: "#888" },
        ].map((s) => (
          <div key={s.label} style={S.statCard}>
            <div style={{ ...S.statVal, color: s.clr }}>{s.value}</div>
            <div style={S.statLbl}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={S.filters}>
        <input
          style={S.search}
          placeholder="Search by player, event, tournament…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {["", "Live", "Upcoming", "Completed"].map((st) => (
          <button
            key={st}
            style={{
              ...S.filtBtn,
              background:
                filterStatus === st ? "rgba(200,255,0,0.12)" : "transparent",
              color: filterStatus === st ? "#c8ff00" : "rgba(255,255,255,0.4)",
              border:
                filterStatus === st
                  ? "1px solid rgba(200,255,0,0.3)"
                  : "1px solid rgba(255,255,255,0.1)",
            }}
            onClick={() => setFilterStatus(st)}
          >
            {st || "All"}
          </button>
        ))}
      </div>

      {/* Header */}
      <div style={S.headerRow}>
        {[
          "",
          "Teams",
          "Event",
          "Tournament",
          "Type",
          "Court",
          "Time",
          "",
          "",
        ].map((h, i) => (
          <div key={i} style={S.headerCell}>
            {h}
          </div>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>No matches found.</div>
      ) : (
        filtered.map((m) => (
          <MatchRow
            key={m.id}
            m={m}
            onEdit={setEditing}
            onDelete={handleDelete}
          />
        ))
      )}

      {(showCreate || editing) && (
        <Modal
          title={editing ? "Edit match" : "New match"}
          width={720}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
        >
          <MatchForm
            initial={editing}
            onSave={() => {
              setShowCreate(false);
              setEditing(null);
              refresh();
            }}
            onClose={() => {
              setShowCreate(false);
              setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  input:focus, select:focus { outline: none; border-color: rgba(200,255,0,0.5) !important; box-shadow: 0 0 0 3px rgba(200,255,0,0.08); }
  select option, select optgroup { background: #1a1a1a; color: #fff; }
`;

const S = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    fontFamily: "'DM Sans', sans-serif",
    color: "#fff",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 34,
    color: "#fff",
  },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6 },
  createBtn: {
    background: "#c8ff00",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 10,
    padding: "11px 20px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },

  statRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  statCard: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "14px 18px",
  },
  statVal: { fontSize: 26, fontWeight: 600 },
  statLbl: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },

  filters: { display: "flex", gap: 8, flexWrap: "wrap" },
  search: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 14px",
    color: "#fff",
    fontSize: 13,
    flex: 1,
    minWidth: 200,
  },
  filtBtn: {
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  headerRow: {
    display: "grid",
    gridTemplateColumns: "18px 1fr 110px 130px 90px 90px 110px 60px 70px",
    gap: 8,
    padding: "0 12px",
    marginBottom: -8,
  },
  headerCell: {
    fontSize: 10,
    color: "rgba(255,255,255,0.2)",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },

  row: {
    display: "grid",
    gridTemplateColumns: "18px 1fr 110px 130px 90px 90px 110px 60px 70px",
    gap: 8,
    alignItems: "center",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "12px",
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  rowTeams: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  teamName: {
    fontSize: 13,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowVs: { fontSize: 11, color: "rgba(255,255,255,0.25)", flexShrink: 0 },
  rowMeta: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  eventTag: {
    background: "rgba(200,255,0,0.08)",
    color: "#c8ff00",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 600,
  },
  pin: {
    fontSize: 11,
    color: "#c8ff00",
    background: "rgba(200,255,0,0.08)",
    borderRadius: 6,
    padding: "3px 8px",
    textAlign: "center",
  },
  rowActions: { display: "flex", gap: 6 },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    cursor: "pointer",
  },
  delBtn: {
    background: "rgba(255,60,60,0.1)",
    color: "#f87171",
    border: "none",
    borderRadius: 6,
    padding: "5px 10px",
    fontSize: 12,
    cursor: "pointer",
  },
  empty: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
    padding: "40px 0",
    textAlign: "center",
  },

  // ── Form ──
  errBox: {
    background: "rgba(255,60,60,0.12)",
    border: "1px solid rgba(255,60,60,0.25)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#f87171",
    fontSize: 13,
  },
  cancelBtn: {
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 13,
    cursor: "pointer",
  },
  divider: { borderTop: "1px solid rgba(255,255,255,0.07)", margin: "2px 0" },

  eventPickerBox: {
    background: "rgba(200,255,0,0.04)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  eventPickerLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#c8ff00",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  eventPickerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 4,
  },
  eventSelect: {
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(200,255,0,0.2)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 13,
    width: "100%",
  },

  filterNotice: {
    borderRadius: 8,
    padding: "10px 14px",
    border: "1px solid",
    fontSize: 13,
  },

  teamGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 36px 1fr",
    gap: 8,
    alignItems: "start",
  },
  teamCol: { display: "flex", flexDirection: "column", gap: 12 },
  teamLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 4,
  },
  vsCol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 36,
    fontSize: 13,
    color: "rgba(255,255,255,0.25)",
    fontWeight: 700,
  },
};
