// src/pages/director/Events.jsx
//
// Manages tournament event categories.
// - Each event card has a "Manage Players" button (unchanged).
// - Doubles/Mixed-Doubles event cards also have a "Manage Teams" button
//   that lets the director pair registered players into DoublesTeam records.
//   Selecting a team in the match-creation form fills both player slots at once.

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { useAuth } from "../../context/AuthContext";
import PlayerSearchPicker from "../../components/PlayerSearchPicker";
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
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `/api/event-registrations/?event=${event.id}`,
      );
      const data = await res.json();
      setRegistrations(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError("Failed to load registrations.");
    } finally {
      setLoading(false);
    }
  }, [event.id, authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const registeredIds = new Set(registrations.map((r) => r.player));

  const handleAdd = async (player) => {
    setAdding(true);
    setError("");
    try {
      const res = await authFetch("/api/event-registrations/", {
        method: "POST",
        body: JSON.stringify({ event: event.id, player: player.id }),
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

      {/* Search & add */}
      <div>
        <div style={PR.sectionLabel}>Add Players</div>
        <div style={PR.searchHint}>
          Type a name to search all players. Already-registered players are
          hidden.
        </div>
        <PlayerSearchPicker
          onSelect={handleAdd}
          excludeIds={registeredIds}
          placeholder="Search players to add…"
          disabled={adding}
        />
      </div>

      <div style={S.divider} />

      {/* Registered list */}
      <div>
        <div
          style={{
            ...PR.sectionLabel,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Registered Players</span>
          <span style={{ color: "#c8ff00", fontWeight: 700 }}>
            {registrations.length}
          </span>
        </div>
        {loading ? (
          <div style={PR.emptyMsg}>Loading…</div>
        ) : registrations.length === 0 ? (
          <div style={PR.emptyMsg}>
            No players registered yet. Search above to add.
          </div>
        ) : (
          <div style={PR.playerList}>
            {registrations.map((reg) => (
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
                  title="Remove"
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

// ─── Team Registration Panel (NEW) ───────────────────────────────────────────
function TeamRegistrationPanel({ event, onClose }) {
  const { authFetch } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // new team being built — pick player1 first, then player2
  const [newTeam, setNewTeam] = useState({
    player1: null,
    player2: null,
    name: "",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/doubles-teams/?event=${event.id}`);
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError("Failed to load teams.");
    } finally {
      setLoading(false);
    }
  }, [event.id, authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const usedPlayerIds = new Set(teams.flatMap((t) => [t.player1, t.player2]));

  // IDs excluded per picker: used globally + the other slot's selection
  const excludeForP1 = new Set([
    ...usedPlayerIds,
    ...(newTeam.player2 ? [newTeam.player2.id] : []),
  ]);
  const excludeForP2 = new Set([
    ...usedPlayerIds,
    ...(newTeam.player1 ? [newTeam.player1.id] : []),
  ]);

  const handleCreate = async () => {
    if (!newTeam.player1 || !newTeam.player2) {
      setError("Please select both players.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        event: event.id,
        player1: newTeam.player1.id,
        player2: newTeam.player2.id,
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
      setNewTeam({ player1: null, player2: null, name: "" });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <div style={S.errBox}>{error}</div>}

      {/* Info banner */}
      <div style={TM.infoBanner}>
        <span style={{ fontSize: 13, color: "rgba(255,200,0,0.8)" }}>
          🤝 Teams created here appear as single dropdowns in match creation,
          filling both player slots automatically.
        </span>
      </div>

      {/* Create new team */}
      <div style={TM.createBox}>
        <div style={TM.createTitle}>Create New Team</div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          {/* Player 1 picker */}
          <div>
            <div style={TM.slotLabel}>Player 1</div>
            {newTeam.player1 ? (
              <div style={TM.selectedPlayer}>
                <div style={TM.selectedAvatar}>
                  {newTeam.player1.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>
                    {newTeam.player1.name}
                  </div>
                  {newTeam.player1.country_name && (
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}
                    >
                      {newTeam.player1.country_name}
                    </div>
                  )}
                </div>
                <button
                  style={TM.clearSlotBtn}
                  onClick={() => setNewTeam((f) => ({ ...f, player1: null }))}
                >
                  ✕
                </button>
              </div>
            ) : (
              <PlayerSearchPicker
                onSelect={(p) => setNewTeam((f) => ({ ...f, player1: p }))}
                excludeIds={excludeForP1}
                placeholder="Search player 1…"
              />
            )}
          </div>

          {/* Player 2 picker */}
          <div>
            <div style={TM.slotLabel}>Player 2</div>
            {newTeam.player2 ? (
              <div style={TM.selectedPlayer}>
                <div style={TM.selectedAvatar}>
                  {newTeam.player2.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>
                    {newTeam.player2.name}
                  </div>
                  {newTeam.player2.country_name && (
                    <div
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}
                    >
                      {newTeam.player2.country_name}
                    </div>
                  )}
                </div>
                <button
                  style={TM.clearSlotBtn}
                  onClick={() => setNewTeam((f) => ({ ...f, player2: null }))}
                >
                  ✕
                </button>
              </div>
            ) : (
              <PlayerSearchPicker
                onSelect={(p) => setNewTeam((f) => ({ ...f, player2: p }))}
                excludeIds={excludeForP2}
                placeholder="Search player 2…"
                disabled={!newTeam.player1}
              />
            )}
          </div>
        </div>

        {/* Optional name */}
        <div style={{ marginTop: 12 }}>
          <div style={TM.slotLabel}>Team name (optional)</div>
          <input
            style={TM.nameInput}
            placeholder={
              newTeam.player1 && newTeam.player2
                ? `${newTeam.player1.name} / ${newTeam.player2.name}`
                : "Auto-generated from player names"
            }
            value={newTeam.name}
            onChange={(e) =>
              setNewTeam((f) => ({ ...f, name: e.target.value }))
            }
          />
        </div>

        <div
          style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}
        >
          <button
            style={{
              ...TM.addTeamBtn,
              opacity: newTeam.player1 && newTeam.player2 && !saving ? 1 : 0.4,
              cursor:
                newTeam.player1 && newTeam.player2 && !saving
                  ? "pointer"
                  : "not-allowed",
            }}
            onClick={handleCreate}
            disabled={!newTeam.player1 || !newTeam.player2 || saving}
          >
            {saving ? "Adding…" : "＋ Add Team"}
          </button>
        </div>
      </div>

      {/* Team list */}
      <div>
        <div style={TM.listTitle}>
          Registered Teams
          <span style={TM.listCount}>{teams.length}</span>
        </div>
        {loading ? (
          <div style={TM.emptyMsg}>Loading…</div>
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

function EventCard({
  ev,
  onEdit,
  onDelete,
  onManagePlayers,
  onManageTeams,
  onViewBracket,
}) {
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
            {/* Bracket button (knockout events only) — NEW */}
            {ev.format === "KNOCKOUT" && (
              <button style={S.bracketBtn} onClick={() => onViewBracket(ev)}>
                🏆 Bracket
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
        <button style={S.bracketBtn} onClick={() => onViewBracket(ev)}>
          View Bracket
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Events() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
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
              onViewBracket={(ev) =>
                navigate(`/director/events/${ev.id}/bracket`)
              }
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
  bracketBtn: {
    background: "rgba(200,255,0,0.08)",
    color: "#c8ff00",
    border: "1px solid rgba(200,255,0,0.25)",
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: 6,
  },
  searchHint: { fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 8 },
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
  slotLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  selectedPlayer: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    background: "rgba(200,255,0,0.06)",
    border: "1px solid rgba(200,255,0,0.15)",
    borderRadius: 8,
  },
  selectedAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "rgba(200,255,0,0.1)",
    color: "#c8ff00",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 12,
    flexShrink: 0,
  },
  clearSlotBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    cursor: "pointer",
    padding: "2px 4px",
  },
  nameInput: {
    width: "100%",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "#fff",
    fontSize: 13,
    outline: "none",
  },
  addTeamBtn: {
    background: "rgba(200,255,0,0.15)",
    color: "#c8ff00",
    border: "1px solid rgba(200,255,0,0.25)",
    borderRadius: 8,
    padding: "9px 20px",
    fontSize: 13,
    fontWeight: 700,
  },
};
