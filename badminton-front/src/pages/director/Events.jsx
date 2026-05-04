// src/pages/director/Events.jsx
//
// Manages tournament event categories.
// NEW: Each event card has a "Players" button to manage registrations.
//      Registered players are filtered in the match creation form.

import { useState, useEffect, useCallback } from "react";
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
    match_type: initial?.match_type || "SINGLE",
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

// ─── Player Registration Panel ────────────────────────────────────────────────

function PlayerRegistrationPanel({ event, onClose }) {
  const { authFetch } = useAuth();
  const [registrations, setRegistrations] = useState([]); // { id, player, player_name, player_country }
  const [allPlayers, setAllPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [regRes, playersRes] = await Promise.all([
        authFetch(`/api/event-registrations/?event=${event.id}`),
        authFetch("/api/players/"),
      ]);
      const regData = await regRes.json();
      const playersData = await playersRes.json();
      setRegistrations(
        Array.isArray(regData) ? regData : regData.results || [],
      );
      setAllPlayers(
        Array.isArray(playersData) ? playersData : playersData.results || [],
      );
    } catch (e) {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [event.id, authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const registeredIds = new Set(registrations.map((r) => r.player));

  const unregisteredPlayers = allPlayers.filter(
    (p) =>
      !registeredIds.has(p.id) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = async (playerId) => {
    setAdding(true);
    setError("");
    try {
      const res = await authFetch("/api/event-registrations/", {
        method: "POST",
        body: JSON.stringify({ event: event.id, player: playerId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Object.values(d).flat().join(" "));
      }
      await loadData();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (registrationId) => {
    setError("");
    try {
      const res = await authFetch(
        `/api/event-registrations/${registrationId}/`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) throw new Error("Failed to remove player.");
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  const typeClr = TYPE_CLR[event.match_type] || TYPE_CLR.SINGLE;

  return (
    <div style={PR.wrap}>
      {/* Header */}
      <div style={PR.header}>
        <div>
          <div style={PR.eventName}>{event.name}</div>
          <div style={PR.eventMeta}>
            <span
              style={{
                ...PR.badge,
                background: typeClr.bg,
                color: typeClr.text,
              }}
            >
              {MATCH_TYPES.find((m) => m.value === event.match_type)?.label ||
                event.match_type}
            </span>
            <span style={PR.regCount}>{registrations.length} registered</span>
            {registrations.length === 0 && (
              <span style={PR.noRegNote}>
                ⚠ No players registered — all players shown in match creation
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <div style={S.errBox}>{error}</div>}

      <div style={PR.columns}>
        {/* Left: Registered players */}
        <div style={PR.col}>
          <div style={PR.colHead}>
            <span style={PR.colTitle}>Registered Players</span>
            <span style={PR.colCount}>{registrations.length}</span>
          </div>
          <div style={PR.playerList}>
            {loading ? (
              <div style={PR.emptyMsg}>Loading…</div>
            ) : registrations.length === 0 ? (
              <div style={PR.emptyMsg}>
                No players registered yet. Add players from the right.
              </div>
            ) : (
              registrations.map((reg) => (
                <div key={reg.id} style={PR.playerRow}>
                  <div style={PR.playerAvatar}>
                    {reg.player_name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={PR.playerInfo}>
                    <div style={PR.playerName}>{reg.player_name}</div>
                    {reg.player_country && (
                      <div style={PR.playerCountry}>{reg.player_country}</div>
                    )}
                  </div>
                  <button
                    style={PR.removeBtn}
                    onClick={() => handleRemove(reg.id)}
                    title="Remove from event"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Available players to add */}
        <div style={PR.col}>
          <div style={PR.colHead}>
            <span style={PR.colTitle}>Add Players</span>
            <span style={PR.colCount}>
              {unregisteredPlayers.length} available
            </span>
          </div>
          <input
            style={PR.searchInput}
            placeholder="Search players…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={PR.playerList}>
            {loading ? (
              <div style={PR.emptyMsg}>Loading…</div>
            ) : unregisteredPlayers.length === 0 ? (
              <div style={PR.emptyMsg}>
                {search
                  ? "No players match your search."
                  : "All players are registered."}
              </div>
            ) : (
              unregisteredPlayers.map((p) => (
                <div key={p.id} style={PR.playerRow}>
                  <div
                    style={{
                      ...PR.playerAvatar,
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.4)",
                    }}
                  >
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={PR.playerInfo}>
                    <div style={PR.playerName}>{p.name}</div>
                    {p.country_name && (
                      <div style={PR.playerCountry}>{p.country_name}</div>
                    )}
                  </div>
                  <button
                    style={PR.addBtn}
                    onClick={() => handleAdd(p.id)}
                    disabled={adding}
                    title="Add to event"
                  >
                    +
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}
      >
        <button style={S.cancelBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ ev, onEdit, onDelete, onManagePlayers }) {
  const typeClr = TYPE_CLR[ev.match_type] || TYPE_CLR.SINGLE;
  const fmtClr = FORMAT_CLR[ev.format] || FORMAT_CLR[""];
  const typeLabel =
    MATCH_TYPES.find((m) => m.value === ev.match_type)?.label || ev.match_type;
  const fmtLabel =
    FORMATS.find((f) => f.value === ev.format)?.label || "Not set";
  const regCount = ev.registered_count ?? 0;

  return (
    <div style={S.card}>
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

        {/* Player registration summary */}
        <div style={S.regBar}>
          <span style={S.regLabel}>
            {regCount > 0 ? (
              <>
                <span style={{ color: "#c8ff00", fontWeight: 600 }}>
                  {regCount}
                </span>{" "}
                player{regCount !== 1 ? "s" : ""} registered
              </>
            ) : (
              <span style={{ color: "rgba(255,255,255,0.3)" }}>
                No registrations — shows all players
              </span>
            )}
          </span>
          <button style={S.playersBtn} onClick={() => onManagePlayers(ev)}>
            👥 Manage Players
          </button>
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
  const [managingEvent, setManagingEvent] = useState(null);
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

  const totalMatches = evArr.reduce((s, e) => s + (e.match_count || 0), 0);
  const totalUpcoming = evArr.reduce((s, e) => s + (e.upcoming_count || 0), 0);
  const totalLive = evArr.reduce((s, e) => s + (e.live_count || 0), 0);
  const totalReg = evArr.reduce((s, e) => s + (e.registered_count || 0), 0);

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
          { label: "Registered Players", value: totalReg },
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
            Event categories group matches and pre-fill match type. Register
            players per event so only they appear in match creation.
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
              onManagePlayers={setManagingEvent}
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

      {/* Player Registration modal */}
      {managingEvent && (
        <Modal
          title={`Players — ${managingEvent.name}`}
          onClose={() => {
            setManagingEvent(null);
            refresh();
          }}
          width={760}
        >
          <PlayerRegistrationPanel
            event={managingEvent}
            onClose={() => {
              setManagingEvent(null);
              refresh();
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
  select option { background: #1a1a1a; color: #fff; }
`;

const S = {
  page: { fontFamily: "'DM Sans', sans-serif", color: "#fff" },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
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
    gap: 10,
    flexWrap: "wrap",
  },
  cardName: { fontSize: 16, fontWeight: 600, color: "#fff" },
  cardTourn: { fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 },
  cardBadges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },
  badge: {
    fontSize: 11,
    borderRadius: 20,
    padding: "3px 10px",
    fontWeight: 600,
  },
  counts: { display: "flex", gap: 14 },
  countItem: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  countDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    display: "inline-block",
  },

  regBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 10,
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  regLabel: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  playersBtn: {
    background: "rgba(200,255,0,0.08)",
    color: "#c8ff00",
    border: "1px solid rgba(200,255,0,0.2)",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  cardActions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "14px 12px",
    justifyContent: "center",
  },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
  },
  delBtn: {
    background: "rgba(255,60,60,0.1)",
    color: "#f87171",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
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
  errBox: {
    background: "rgba(255,60,60,0.12)",
    border: "1px solid rgba(255,60,60,0.25)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#f87171",
    fontSize: 13,
  },

  empty: {
    color: "rgba(255,255,255,0.2)",
    fontSize: 14,
    padding: "40px 0",
    textAlign: "center",
  },
};

// Player Registration Panel styles
const PR = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 },
  header: {
    borderBottom: "1px solid rgba(255,255,255,0.07)",
    paddingBottom: 14,
  },
  eventName: { fontSize: 18, fontWeight: 600, color: "#fff" },
  eventMeta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    flexWrap: "wrap",
  },
  badge: {
    fontSize: 11,
    borderRadius: 20,
    padding: "3px 10px",
    fontWeight: 600,
  },
  regCount: { fontSize: 13, color: "rgba(255,255,255,0.4)" },
  noRegNote: {
    fontSize: 12,
    color: "#fbbf24",
    background: "rgba(251,191,36,0.08)",
    borderRadius: 6,
    padding: "3px 10px",
  },

  columns: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  col: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  colHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  colCount: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    padding: "2px 8px",
  },

  searchInput: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    padding: "8px 12px",
    color: "#fff",
    fontSize: 13,
    width: "100%",
  },

  playerList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    maxHeight: 320,
    overflowY: "auto",
  },
  playerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 6px",
    borderRadius: 7,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(200,255,0,0.15)",
    color: "#c8ff00",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  playerInfo: { flex: 1, minWidth: 0 },
  playerName: {
    fontSize: 13,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  playerCountry: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 1,
  },

  addBtn: {
    background: "rgba(200,255,0,0.12)",
    color: "#c8ff00",
    border: "1px solid rgba(200,255,0,0.2)",
    borderRadius: 6,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  removeBtn: {
    background: "rgba(255,60,60,0.1)",
    color: "#f87171",
    border: "none",
    borderRadius: 6,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  emptyMsg: {
    fontSize: 13,
    color: "rgba(255,255,255,0.25)",
    padding: "20px 0",
    textAlign: "center",
  },
};
