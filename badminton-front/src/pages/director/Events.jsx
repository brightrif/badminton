// src/pages/director/Events.jsx
//
// Manages tournament event categories.
// - Each event card has a "Manage Players" button (unchanged).
// - Doubles/Mixed-Doubles event cards also have a "Manage Teams" button
//   that lets the director pair registered players into DoublesTeam records.
//   Selecting a team in the match-creation form fills both player slots at once.

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
  const [registrations, setRegistrations] = useState([]);
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
    } catch {
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
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to remove player.");
      await loadData();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div style={S.errBox}>{error}</div>}
      {loading ? (
        <div
          style={{
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            padding: 32,
          }}
        >
          Loading…
        </div>
      ) : (
        <div style={PR.cols}>
          {/* Registered */}
          <div style={PR.col}>
            <div style={PR.colHead}>
              <span style={PR.colTitle}>Registered</span>
              <span style={PR.colCount}>{registrations.length} players</span>
            </div>
            <div style={PR.playerList}>
              {registrations.length === 0 ? (
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

          {/* Available */}
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
              {unregisteredPlayers.length === 0 ? (
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
      )}
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

// ─── Team Registration Panel (NEW) ───────────────────────────────────────────

function TeamRegistrationPanel({ event, onClose }) {
  const { authFetch } = useAuth();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]); // registered players for this event
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newTeam, setNewTeam] = useState({
    player1: "",
    player2: "",
    name: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, playersRes] = await Promise.all([
        authFetch(`/api/doubles-teams/?event=${event.id}`),
        authFetch(
          `/api/event-registrations/players_for_event/?event=${event.id}`,
        ),
      ]);
      const teamsData = await teamsRes.json();
      const playersData = await playersRes.json();
      setTeams(Array.isArray(teamsData) ? teamsData : teamsData.results || []);
      setPlayers(playersData.players || []);
    } catch {
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [event.id, authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTeam.player1 || !newTeam.player2) {
      setError("Please select both players.");
      return;
    }
    if (newTeam.player1 === newTeam.player2) {
      setError("Player 1 and Player 2 must be different.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        event: event.id,
        player1: Number(newTeam.player1),
        player2: Number(newTeam.player2),
      };
      if (newTeam.name.trim()) payload.name = newTeam.name.trim();

      const res = await authFetch("/api/doubles-teams/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Object.values(d).flat().join(" "));
      }
      setNewTeam({ player1: "", player2: "", name: "" });
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (teamId) => {
    setError("");
    try {
      const res = await authFetch(`/api/doubles-teams/${teamId}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to remove team.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  // Players not yet in a team for this event
  const usedPlayerIds = new Set(teams.flatMap((t) => [t.player1, t.player2]));
  const availablePlayers = players; // show all registered; backend validates uniqueness

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={S.errBox}>{error}</div>}

      {/* Info banner */}
      <div style={TM.infoBanner}>
        <span style={{ fontSize: 13, color: "rgba(255,200,0,0.8)" }}>
          🤝 Teams created here will appear as single-select dropdowns in the
          match creation form, automatically filling both player slots.
        </span>
      </div>

      {/* Create new team form */}
      <div style={TM.createBox}>
        <div style={TM.createTitle}>Create New Team</div>
        <form
          onSubmit={handleCreate}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            {/* <FormField label="Player 1">
              <Select
                value={newTeam.player1}
                onChange={(e) =>
                  setNewTeam((f) => ({ ...f, player1: e.target.value }))
                }
                required
              >
                <option value="">— Select —</option>
                {availablePlayers.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={String(p.id) === String(newTeam.player2)}
                  >
                    {p.name}
                    {p.country ? ` (${p.country})` : ""}
                  </option>
                ))}
              </Select>
            </FormField> */}
            {/* <FormField label="Player 2">
              <Select
                value={newTeam.player2}
                onChange={(e) =>
                  setNewTeam((f) => ({ ...f, player2: e.target.value }))
                }
                required
              >
                <option value="">— Select —</option>
                {availablePlayers.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={String(p.id) === String(newTeam.player1)}
                  >
                    {p.name}
                    {p.country ? ` (${p.country})` : ""}
                  </option>
                ))}
              </Select>
            </FormField> */}

            <FormField label="Player 1">
              <Select
                value={newTeam.player1}
                onChange={(e) =>
                  setNewTeam((f) => ({ ...f, player1: e.target.value }))
                }
                required
              >
                <option value="">— Select —</option>
                {availablePlayers
                  .filter(
                    (p) =>
                      // exclude players already in a team, UNLESS they are the currently selected player2
                      !usedPlayerIds.has(p.id) ||
                      String(p.id) === String(newTeam.player2),
                  )
                  .map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={String(p.id) === String(newTeam.player2)}
                    >
                      {p.name}
                      {p.country ? ` (${p.country})` : ""}
                    </option>
                  ))}
              </Select>
            </FormField>

            <FormField label="Player 2">
              <Select
                value={newTeam.player2}
                onChange={(e) =>
                  setNewTeam((f) => ({ ...f, player2: e.target.value }))
                }
                required
              >
                <option value="">— Select —</option>
                {availablePlayers
                  .filter(
                    (p) =>
                      !usedPlayerIds.has(p.id) ||
                      String(p.id) === String(newTeam.player1),
                  )
                  .map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={String(p.id) === String(newTeam.player1)}
                    >
                      {p.name}
                      {p.country ? ` (${p.country})` : ""}
                    </option>
                  ))}
              </Select>
            </FormField>
          </div>
          <FormField
            label="Team name (optional)"
            hint="Leave blank to auto-generate from player names"
          >
            <Input
              value={newTeam.name}
              onChange={(e) =>
                setNewTeam((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="e.g. Ali / Hassan"
            />
          </FormField>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SubmitBtn loading={saving}>＋ Add Team</SubmitBtn>
          </div>
        </form>
      </div>

      {/* Existing teams list */}
      <div>
        <div style={TM.listTitle}>
          Registered Teams
          <span style={TM.listCount}>{teams.length}</span>
        </div>
        {loading ? (
          <div
            style={{
              color: "rgba(255,255,255,0.4)",
              padding: 24,
              textAlign: "center",
            }}
          >
            Loading…
          </div>
        ) : teams.length === 0 ? (
          <div style={TM.emptyMsg}>
            No teams yet. Create your first team above.
          </div>
        ) : (
          <div style={TM.teamList}>
            {teams.map((t) => (
              <div key={t.id} style={TM.teamRow}>
                <div style={TM.teamIcon}>🤝</div>
                <div style={TM.teamInfo}>
                  <div style={TM.teamName}>{t.name}</div>
                  <div style={TM.teamPlayers}>
                    <span style={TM.playerChip}>{t.player1_name}</span>
                    <span style={TM.slash}>/</span>
                    <span style={TM.playerChip}>{t.player2_name}</span>
                  </div>
                </div>
                <button
                  style={TM.deleteBtn}
                  onClick={() => handleDelete(t.id)}
                  title="Remove team"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}
      >
        <button style={S.cancelBtn} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Event card ───────────────────────────────────────────────────────────────

function EventCard({ ev, onEdit, onDelete, onManagePlayers, onManageTeams }) {
  const typeClr = TYPE_CLR[ev.match_type] || TYPE_CLR.SINGLE;
  const fmtClr = FORMAT_CLR[ev.format] || FORMAT_CLR[""];
  const typeLabel =
    MATCH_TYPES.find((m) => m.value === ev.match_type)?.label || ev.match_type;
  const fmtLabel =
    FORMATS.find((f) => f.value === ev.format)?.label || "Not set";
  const regCount = ev.registered_count ?? 0;
  const isDoubles =
    ev.match_type === "DOUBLES" || ev.match_type === "MIXED_DOUBLES";

  return (
    <div style={S.card}>
      <div style={{ ...S.cardAccent, background: typeClr.text }} />
      <div style={S.cardBody}>
        <div style={S.cardTop}>
          <div>
            <div style={S.cardName}>{ev.name}</div>
            <div style={S.cardTourn}>{ev.tournament_name || "—"}</div>
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
            <span
              style={{ ...S.badge, background: fmtClr.bg, color: fmtClr.text }}
            >
              {fmtLabel}
            </span>
            {ev.round_label && (
              <span
                style={{
                  ...S.badge,
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {ev.round_label}
              </span>
            )}
          </div>
        </div>

        <div style={S.counts}>
          {[
            { label: "Matches", val: ev.match_count || 0, color: "#888" },
            { label: "Upcoming", val: ev.upcoming_count || 0, color: "#4af" },
            { label: "Live", val: ev.live_count || 0, color: "#c8ff00" },
            { label: "Done", val: ev.completed_count || 0, color: "#6ee7b7" },
          ].map(({ label, val, color }) => (
            <div key={label} style={S.countItem}>
              <span style={{ ...S.countDot, background: color }} />
              <span style={{ color }}>{val}</span>
              <span style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Registration bar */}
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

          <div style={{ display: "flex", gap: 8 }}>
            {/* Manage Players (always visible) */}
            <button style={S.playersBtn} onClick={() => onManagePlayers(ev)}>
              👥 Manage Players
            </button>

            {/* Manage Teams (doubles / mixed only) */}
            {isDoubles && (
              <button style={S.teamsBtn} onClick={() => onManageTeams(ev)}>
                🤝 Manage Teams
              </button>
            )}
          </div>
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
  const [managingEvent, setManagingEvent] = useState(null); // players panel
  const [teamsEvent, setTeamsEvent] = useState(null); // teams panel  NEW
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

      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <div style={S.title}>Events</div>
          <div style={S.sub}>
            Manage tournament event categories and player registrations
          </div>
        </div>
        <button style={S.createBtn} onClick={() => setShowCreate(true)}>
          + New event
        </button>
      </div>

      {/* Summary pills */}
      <div style={S.summaryRow}>
        {[
          { label: "Events", val: evArr.length, clr: "#c8ff00" },
          { label: "Matches", val: totalMatches, clr: "#4af" },
          { label: "Live now", val: totalLive, clr: "#f87171" },
          { label: "Upcoming", val: totalUpcoming, clr: "#4af" },
          { label: "Reg'd", val: totalReg, clr: "#6ee7b7" },
        ].map(({ label, val, clr }) => (
          <div key={label} style={S.summaryPill}>
            <span style={{ color: clr, fontWeight: 700, fontSize: 20 }}>
              {val}
            </span>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={S.filterRow}>
        <input
          style={S.search}
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={S.search}
          value={filterTournament}
          onChange={(e) => setFilterTournament(e.target.value)}
        >
          <option value="">All tournaments</option>
          {tournArr.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
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
              onManageTeams={setTeamsEvent} // NEW
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

      {/* Team Registration modal — NEW */}
      {teamsEvent && (
        <Modal
          title={`Teams — ${teamsEvent.name}`}
          onClose={() => {
            setTeamsEvent(null);
            refresh();
          }}
          width={680}
        >
          <TeamRegistrationPanel
            event={teamsEvent}
            onClose={() => {
              setTeamsEvent(null);
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
  input:focus, select:focus { outline: none; border-color: rgba(200,255,0,0.4) !important; }
  button:hover { opacity: 0.85; }
`;

const S = {
  page: { display: "flex", flexDirection: "column", gap: 28 },
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
  summaryRow: { display: "flex", gap: 12, flexWrap: "wrap" },
  summaryPill: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    padding: "10px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "center",
  },
  filterRow: { display: "flex", gap: 12 },
  search: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#fff",
    fontSize: 13,
    minWidth: 180,
  },
  empty: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    padding: "48px 0",
    textAlign: "center",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
    gap: 16,
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
    flexWrap: "wrap",
    gap: 8,
  },
  regLabel: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  // Manage Players button (existing style)
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
  // Manage Teams button (NEW — orange accent to differentiate)
  teamsBtn: {
    background: "rgba(255,160,80,0.1)",
    color: "#fdba74",
    border: "1px solid rgba(255,160,80,0.25)",
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
    border: "1px solid rgba(255,60,60,0.2)",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    cursor: "pointer",
  },
  cancelBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 18px",
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    cursor: "pointer",
  },
  errBox: {
    background: "rgba(255,60,60,0.1)",
    border: "1px solid rgba(255,60,60,0.3)",
    color: "#ff6b6b",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
  },
  divider: { height: 1, background: "rgba(255,255,255,0.06)" },
};

// Player panel styles
const PR = {
  cols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  col: { display: "flex", flexDirection: "column", gap: 10 },
  colHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  colTitle: { fontSize: 13, fontWeight: 600, color: "#fff" },
  colCount: { fontSize: 12, color: "rgba(255,255,255,0.35)" },
  searchInput: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    padding: "8px 12px",
    color: "#fff",
    fontSize: 13,
  },
  playerList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    maxHeight: 340,
    overflowY: "auto",
  },
  playerRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
  },
  playerAvatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "rgba(200,255,0,0.1)",
    color: "#c8ff00",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 13,
    flexShrink: 0,
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 13, color: "#fff", fontWeight: 500 },
  playerCountry: { fontSize: 11, color: "rgba(255,255,255,0.35)" },
  removeBtn: {
    background: "rgba(255,60,60,0.1)",
    color: "#f87171",
    border: "none",
    borderRadius: 5,
    width: 26,
    height: 26,
    cursor: "pointer",
    fontSize: 12,
  },
  addBtn: {
    background: "rgba(200,255,0,0.12)",
    color: "#c8ff00",
    border: "none",
    borderRadius: 5,
    width: 26,
    height: 26,
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 700,
  },
  emptyMsg: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13,
    padding: "16px 0",
    textAlign: "center",
  },
};

// Team panel styles (NEW)
const TM = {
  infoBanner: {
    background: "rgba(255,200,0,0.06)",
    border: "1px solid rgba(255,200,0,0.15)",
    borderRadius: 8,
    padding: "10px 14px",
  },
  createBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "16px 18px",
  },
  createTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  listCount: {
    background: "rgba(255,160,80,0.15)",
    color: "#fdba74",
    borderRadius: 20,
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
  },
  teamList: { display: "flex", flexDirection: "column", gap: 8 },
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.07)",
  },
  teamIcon: { fontSize: 18, flexShrink: 0 },
  teamInfo: { flex: 1 },
  teamName: { fontSize: 14, fontWeight: 600, color: "#fff" },
  teamPlayers: { display: "flex", alignItems: "center", gap: 6, marginTop: 3 },
  playerChip: {
    fontSize: 11,
    color: "rgba(255,255,255,0.55)",
    background: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    padding: "2px 7px",
  },
  slash: { color: "rgba(255,160,80,0.6)", fontSize: 12 },
  deleteBtn: {
    background: "rgba(255,60,60,0.1)",
    color: "#f87171",
    border: "none",
    borderRadius: 5,
    width: 28,
    height: 28,
    cursor: "pointer",
    fontSize: 13,
    flexShrink: 0,
  },
  emptyMsg: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 13,
    padding: "20px 0",
    textAlign: "center",
  },
};
