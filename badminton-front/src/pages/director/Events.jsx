// src/pages/director/Events.jsx
//
// Manages tournament event categories.
// Simple CRUD — no bracket logic, no auto-calculation.
// The value: picking an event pre-fills match_type when creating a match.

import { useState } from "react";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { useAuth } from "../../context/AuthContext";
import Modal, {
  FormField,
  Input,
  Select,
  SubmitBtn,
} from "../../components/Modal";

// ─── Constants ────────────────────────────────────────────────────────────────

const MATCH_TYPES = [
  { value: "SINGLE", label: "Singles" },
  { value: "DOUBLES", label: "Doubles" },
  { value: "MIXED_DOUBLES", label: "Mixed Doubles" },
];

const FORMATS = [
  { value: "", label: "Not set" },
  { value: "KNOCKOUT", label: "Knockout" },
  { value: "ROUND_ROBIN", label: "Round Robin" },
];

const TYPE_CLR = {
  SINGLE: { bg: "rgba(100,180,255,0.1)", text: "#93C5FD" },
  DOUBLES: { bg: "rgba(200,255,0,0.1)", text: "#c8ff00" },
  MIXED_DOUBLES: { bg: "rgba(255,160,100,0.1)", text: "#fdba74" },
};

const FORMAT_CLR = {
  KNOCKOUT: { bg: "rgba(245,158,11,0.1)", text: "#fbbf24" },
  ROUND_ROBIN: { bg: "rgba(34,197,94,0.1)", text: "#86efac" },
  "": { bg: "rgba(255,255,255,0.04)", text: "rgba(255,255,255,0.25)" },
};

// ─── Event form (create / edit) ───────────────────────────────────────────────

function EventForm({ initial, tournaments, onSave, onClose }) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    tournament: initial?.tournament || "",
    name: initial?.name || "",
    match_type: initial?.match_type || "SINGLES",
    format: initial?.format || "",
    round_label: initial?.round_label || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(
        initial ? `/api/events/${initial.id}/` : "/api/events/",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(form) },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Object.values(d).flat().join(" "));
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

      <FormField label="Tournament">
        <Select value={form.tournament} onChange={set("tournament")} required>
          <option value="">— Select tournament —</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Event name"
        hint='e.g. "MD Level 1", "WD Level 2 (F3 & F4)", "XD Championship"'
      >
        <Input
          value={form.name}
          onChange={set("name")}
          placeholder="MD Level 1"
          required
        />
      </FormField>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormField label="Match type" hint="Pre-fills match creation form">
          <Select value={form.match_type} onChange={set("match_type")} required>
            {MATCH_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Format" hint="For your reference only">
          <Select value={form.format} onChange={set("format")}>
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField
        label="Round / stage label"
        hint='Optional — e.g. "Quarter Final", "Group Stage"'
      >
        <Input
          value={form.round_label}
          onChange={set("round_label")}
          placeholder="e.g. Quarter Final"
        />
      </FormField>

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
          {initial ? "Save changes" : "Create event"}
        </SubmitBtn>
      </div>
    </form>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ ev, onEdit, onDelete }) {
  const typeClr = TYPE_CLR[ev.match_type] || TYPE_CLR.SINGLE;
  const fmtClr = FORMAT_CLR[ev.format] || FORMAT_CLR[""];
  const typeLabel =
    MATCH_TYPES.find((m) => m.value === ev.match_type)?.label || ev.match_type;
  const fmtLabel =
    FORMATS.find((f) => f.value === ev.format)?.label || "Not set";

  return (
    <div style={S.card}>
      {/* Left accent bar keyed to match type */}
      <div style={{ ...S.cardAccent, background: typeClr.text }} />

      <div style={S.cardBody}>
        <div style={S.cardTop}>
          <div>
            <div style={S.cardName}>{ev.name}</div>
            <div style={S.cardTourn}>{ev.tournament_name}</div>
          </div>
          <div style={S.cardBadges}>
            <span
              style={{
                ...S.badge,
                background: typeClr.bg,
                color: typeClr.text,
              }}
            >
              {typeLabel}
            </span>
            {ev.format && (
              <span
                style={{
                  ...S.badge,
                  background: fmtClr.bg,
                  color: fmtClr.text,
                }}
              >
                {fmtLabel}
              </span>
            )}
            {ev.round_label && (
              <span
                style={{
                  ...S.badge,
                  background: "rgba(255,255,255,0.06)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {ev.round_label}
              </span>
            )}
          </div>
        </div>

        {/* Match counts */}
        <div style={S.counts}>
          <span style={S.countItem}>
            <span style={{ ...S.countDot, background: "#4af" }} />
            {ev.upcoming_count} upcoming
          </span>
          <span style={S.countItem}>
            <span style={{ ...S.countDot, background: "#c8ff00" }} />
            {ev.live_count} live
          </span>
          <span style={S.countItem}>
            <span style={{ ...S.countDot, background: "#888" }} />
            {ev.completed_count} done
          </span>
        </div>
      </div>

      <div style={S.cardActions}>
        <button style={S.editBtn} onClick={() => onEdit(ev)}>
          Edit
        </button>
        <button style={S.delBtn} onClick={() => onDelete(ev)}>
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Events() {
  const { authFetch } = useAuth();
  const { data: events, loading, refresh } = useApi("/api/events/");
  const { data: tournaments } = useApi("/api/tournaments/");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTournament, setFilterTournament] = useState("");

  const evArr = Array.isArray(events) ? events : [];
  const tournArr = Array.isArray(tournaments) ? tournaments : [];

  const filtered = evArr.filter((ev) => {
    const matchSearch = ev.name.toLowerCase().includes(search.toLowerCase());
    const matchTourn =
      !filterTournament || String(ev.tournament) === filterTournament;
    return matchSearch && matchTourn;
  });

  // Stats
  const totalMatches = evArr.reduce((s, e) => s + (e.match_count || 0), 0);
  const totalUpcoming = evArr.reduce((s, e) => s + (e.upcoming_count || 0), 0);
  const totalLive = evArr.reduce((s, e) => s + (e.live_count || 0), 0);

  const handleDelete = async (ev) => {
    if (!confirm(`Delete event "${ev.name}"?`)) return;
    const res = await authFetch(`/api/events/${ev.id}/`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error || "Could not delete event.");
      return;
    }
    refresh();
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Stats */}
      <div style={S.statsRow}>
        {[
          { label: "Events", value: evArr.length },
          { label: "Matches", value: totalMatches },
          { label: "Upcoming", value: totalUpcoming },
          { label: "Live now", value: totalLive },
        ].map((s) => (
          <div key={s.label} style={S.statCard}>
            <div style={S.statVal}>{s.value}</div>
            <div style={S.statLbl}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <div style={S.pageTitle}>Events</div>
          <div style={S.pageSub}>
            Event categories group matches and pre-fill the match type when
            creating a new match.
          </div>
        </div>
        <div style={S.topActions}>
          <select
            style={S.filterSelect}
            value={filterTournament}
            onChange={(e) => setFilterTournament(e.target.value)}
          >
            <option value="">All tournaments</option>
            {tournArr.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input
            style={S.search}
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>
            + New event
          </button>
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          {evArr.length === 0
            ? "No events yet. Create your first event to get started."
            : "No events match your search."}
        </div>
      ) : (
        <div style={S.grid}>
          {filtered.map((ev) => (
            <EventCard
              key={ev.id}
              ev={ev}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <Modal
          title="New event"
          onClose={() => setShowCreate(false)}
          width={520}
        >
          <EventForm
            tournaments={tournArr}
            onSave={() => {
              setShowCreate(false);
              refresh();
            }}
            onClose={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editing && (
        <Modal title="Edit event" onClose={() => setEditing(null)} width={520}>
          <EventForm
            initial={editing}
            tournaments={tournArr}
            onSave={() => {
              setEditing(null);
              refresh();
            }}
            onClose={() => setEditing(null)}
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
  select option { background: #1a1a1a; color: #fff; }
`;

const S = {
  page: { fontFamily: "'DM Sans', sans-serif", color: "#fff" },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "16px 20px",
  },
  statVal: { fontSize: 26, fontWeight: 600, color: "#c8ff00" },
  statLbl: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },

  topBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 16,
    flexWrap: "wrap",
  },
  pageTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 34,
    color: "#fff",
  },
  pageSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    marginTop: 6,
    maxWidth: 500,
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  filterSelect: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 14px",
    color: "#fff",
    fontSize: 13,
  },
  search: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 14px",
    color: "#fff",
    fontSize: 13,
    width: 200,
  },
  createBtn: {
    background: "#c8ff00",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 12,
  },

  card: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 14,
    overflow: "hidden",
    display: "flex",
    position: "relative",
  },
  cardAccent: { width: 3, flexShrink: 0 },
  cardBody: {
    flex: 1,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardName: { fontSize: 14, fontWeight: 600, color: "#fff" },
  cardTourn: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 },
  cardBadges: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  badge: {
    fontSize: 11,
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: 20,
  },

  counts: { display: "flex", gap: 14 },
  countItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  countDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },

  cardActions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "14px 14px 14px 0",
    justifyContent: "center",
  },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    padding: "6px 14px",
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    cursor: "pointer",
  },
  delBtn: {
    background: "none",
    border: "1px solid rgba(255,80,80,0.2)",
    borderRadius: 7,
    padding: "6px 14px",
    color: "rgba(255,100,100,0.7)",
    fontSize: 12,
    cursor: "pointer",
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
  empty: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    padding: "60px 0",
    textAlign: "center",
  },
};
