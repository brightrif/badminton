// src/pages/director/Matches.jsx
// Updated — adds Event selector that pre-fills match_type automatically.
// Everything else (player selection, court, time, PIN) remains manual.

import { useState, useEffect } from "react";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { useAuth } from "../../context/AuthContext";
import Modal, {
  FormField,
  Input,
  Select,
  SubmitBtn,
} from "../../components/Modal";

const STATUS_CLR = { Live: "#c8ff00", Completed: "#888", Upcoming: "#4af" };

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
      <div style={S.rowMeta}>{m.match_type?.replace("_", " ")}</div>
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
  const { data: players } = useApi("/api/players/");
  const { data: venues } = useApi("/api/venues/");
  const { data: courts } = useApi("/api/courts/");
  const { data: allEvents } = useApi("/api/events/");

  const [form, setForm] = useState({
    tournament: initial?.tournament || "",
    event: initial?.event || "",
    match_type: initial?.match_type || "SINGLE",
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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // When an event is selected → auto-fill tournament and match_type
  const handleEventChange = (e) => {
    const eventId = e.target.value;
    const evArr = Array.isArray(allEvents) ? allEvents : [];
    const chosen = evArr.find((ev) => String(ev.id) === eventId);
    setForm((f) => ({
      ...f,
      event: eventId,
      match_type: chosen ? chosen.match_type : f.match_type,
      tournament: chosen ? String(chosen.tournament) : f.tournament,
    }));
  };

  // When tournament changes → clear event if it doesn't belong to new tournament
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
  const playerOpts = Array.isArray(players) ? players : [];
  const tournOpts = Array.isArray(tournaments) ? tournaments : [];
  const venueOpts = Array.isArray(venues) ? venues : [];
  const courtOpts = Array.isArray(courts) ? courts : [];
  const evArr = Array.isArray(allEvents) ? allEvents : [];

  // Events filtered to selected tournament
  const eventOpts = form.tournament
    ? evArr.filter((ev) => String(ev.tournament) === String(form.tournament))
    : evArr;

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

      {/* ── Event picker (top of form — drives everything below) ── */}
      <div style={S.eventPickerBox}>
        <div style={S.eventPickerLabel}>Event category</div>
        <div style={S.eventPickerSub}>
          Selecting an event pre-fills the tournament and match type
          automatically.
        </div>
        <select
          style={S.eventSelect}
          value={form.event}
          onChange={handleEventChange}
        >
          <option value="">— No event / pick manually —</option>
          {/* Group by tournament name */}
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

      <div style={S.divider} />

      {/* ── Tournament + match type (auto-filled, still editable) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
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
        <FormField label="Match type">
          <Select value={form.match_type} onChange={set("match_type")}>
            <option value="SINGLE">Singles</option>
            <option value="DOUBLES">Doubles</option>
            <option value="MIXED_DOUBLES">Mixed Doubles</option>
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
                  </option>
                ))}
              </Select>
            </FormField>
          )}
        </div>
      </div>

      {/* ── Serving, venue, court ── */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}
      >
        <FormField label="Serving player">
          <Select value={form.server} onChange={set("server")}>
            <option value="">— Select —</option>
            {activePlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Venue">
          <Select value={form.venue} onChange={set("venue")}>
            <option value="">— None —</option>
            {venueOpts.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Court">
          <Select value={form.court} onChange={set("court")}>
            <option value="">— None —</option>
            {courtOpts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {/* ── Time + status ── */}
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
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const url = filter === "all" ? "/api/matches/" : `/api/matches/${filter}/`;
  const { data, loading, refresh } = useApi(url, [filter]);

  const handleDelete = async (m) => {
    if (!confirm("Delete this match?")) return;
    await authFetch(`/api/matches/${m.id}/`, { method: "DELETE" });
    refresh();
  };

  const matches = (Array.isArray(data) ? data : []).filter(
    (m) =>
      !search || JSON.stringify(m).toLowerCase().includes(search.toLowerCase()),
  );

  const FILTERS = [
    { key: "all", label: "All" },
    { key: "live", label: "Live" },
    { key: "upcoming", label: "Upcoming" },
    { key: "today", label: "Today" },
  ];

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.topBar}>
        <div>
          <div style={S.title}>Matches</div>
          <div style={S.sub}>
            {matches.length} match{matches.length !== 1 ? "es" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            style={S.search}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>
            + New match
          </button>
        </div>
      </div>

      <div style={S.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            style={{
              ...S.filterBtn,
              ...(filter === f.key ? S.filterActive : {}),
            }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={S.loading}>Loading…</div>
      ) : (
        <div style={S.table}>
          <div style={S.tableHead}>
            <span>Match</span>
            <span>Event</span>
            <span>Tournament</span>
            <span>Type</span>
            <span>Court</span>
            <span>Time</span>
            <span>PIN</span>
            <span />
          </div>
          {matches.length === 0 ? (
            <div style={S.empty}>No matches found.</div>
          ) : (
            matches.map((m) => (
              <MatchRow
                key={m.id}
                m={m}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
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
    gap: 24,
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
  search: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 13,
    width: 200,
  },
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

  filters: { display: "flex", gap: 8 },
  filterBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "8px 16px",
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    cursor: "pointer",
  },
  filterActive: {
    background: "rgba(200,255,0,0.1)",
    borderColor: "rgba(200,255,0,0.3)",
    color: "#c8ff00",
  },

  loading: { color: "rgba(255,255,255,0.3)", fontSize: 14 },
  empty: { color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "24px 0" },

  table: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 70px 80px",
    gap: 8,
    padding: "12px 20px",
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 70px 80px",
    gap: 8,
    padding: "14px 20px",
    alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%", position: "absolute" },
  rowTeams: { display: "flex", alignItems: "center", gap: 6 },
  teamName: { fontSize: 13, color: "#fff", fontWeight: 500 },
  rowVs: { fontSize: 11, color: "rgba(255,255,255,0.25)" },
  rowMeta: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  eventTag: {
    fontSize: 11,
    background: "rgba(200,255,0,0.08)",
    color: "#c8ff00",
    padding: "2px 8px",
    borderRadius: 10,
    border: "1px solid rgba(200,255,0,0.2)",
  },
  pin: { fontSize: 11, color: "rgba(255,255,255,0.35)" },
  rowActions: { display: "flex", gap: 6 },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    padding: "5px 12px",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    cursor: "pointer",
  },
  delBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,80,80,0.5)",
    fontSize: 16,
    cursor: "pointer",
    padding: "4px 8px",
  },

  // Form
  eventPickerBox: {
    background: "rgba(200,255,0,0.04)",
    border: "1px solid rgba(200,255,0,0.15)",
    borderRadius: 10,
    padding: "14px 16px",
  },
  eventPickerLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#c8ff00",
    marginBottom: 4,
  },
  eventPickerSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginBottom: 10,
  },
  eventSelect: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 13,
  },
  divider: { height: 1, background: "rgba(255,255,255,0.06)" },
  teamGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 40px 1fr",
    gap: 8,
    alignItems: "start",
  },
  teamCol: { display: "flex", flexDirection: "column", gap: 12 },
  teamLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.35)",
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
    color: "rgba(255,255,255,0.3)",
    fontWeight: 600,
  },
  cancelBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 13,
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
  },
  errBox: {
    background: "rgba(255,80,80,0.1)",
    border: "1px solid rgba(255,80,80,0.2)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    color: "#ff8080",
  },
};
