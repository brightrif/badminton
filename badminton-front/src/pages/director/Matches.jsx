// src/pages/director/Matches.jsx
//
// Changes from previous version:
//  - MatchForm now loads doubles teams for the selected event
//  - When an event is DOUBLES/MIXED_DOUBLES AND teams exist → shows team dropdowns
//    instead of 4 individual player pickers; selecting a team fills both player FKs
//  - "Team mode" badge shown in player source bar when teams are active
//  - Individual player pickers remain when no teams exist (graceful fallback)

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

function MatchRow({ m, onEdit, onDelete, editLoadingId }) {
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
        <button
          style={S.editBtn}
          onClick={() => onEdit(m)}
          disabled={editLoadingId === m.id}
        >
          {editLoadingId === m.id ? "…" : "Edit"}
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
  const [eventPlayers, setEventPlayers] = useState(null);
  const [loadingEventPlayers, setLoadingEventPlayers] = useState(false);
  const [playerSource, setPlayerSource] = useState("all");

  // ── NEW: doubles teams ─────────────────────────────────────────────────────
  const [eventTeams, setEventTeams] = useState([]); // DoublesTeam[]
  const [loadingTeams, setLoadingTeams] = useState(false);
  // Selected team IDs (for the two sides)
  const [selectedTeam1Id, setSelectedTeam1Id] = useState("");
  const [selectedTeam2Id, setSelectedTeam2Id] = useState("");
  // ── Pre-select teams when editing (find teams matching the initial player IDs) ──
  useEffect(() => {
    if (!initial || eventTeams.length === 0) return;

    const p1t1 = String(initial.player1_team1 || "");
    const p2t1 = String(initial.player2_team1 || "");
    const p1t2 = String(initial.player1_team2 || "");
    const p2t2 = String(initial.player2_team2 || "");

    // Find team whose player1+player2 match the form's team1 players
    const matchedTeam1 = eventTeams.find(
      (t) => String(t.player1_id) === p1t1 && String(t.player2_id) === p2t1,
    );
    const matchedTeam2 = eventTeams.find(
      (t) => String(t.player1_id) === p1t2 && String(t.player2_id) === p2t2,
    );

    if (matchedTeam1) setSelectedTeam1Id(String(matchedTeam1.id));
    if (matchedTeam2) setSelectedTeam2Id(String(matchedTeam2.id));
  }, [eventTeams, initial]);
  // ── Load registered players when event changes ─────────────────────────────
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

  // ── NEW: load doubles teams when event changes ─────────────────────────────
  const loadEventTeams = useCallback(
    async (eventId, matchType) => {
      const isDoubles =
        matchType === "DOUBLES" || matchType === "MIXED_DOUBLES";
      if (!eventId || !isDoubles) {
        setEventTeams([]);
        return;
      }
      setLoadingTeams(true);
      try {
        const res = await authFetch(
          `/api/doubles-teams/teams_for_event/?event=${eventId}`,
        );
        const data = await res.json();
        setEventTeams(data.teams || []);
      } catch {
        setEventTeams([]);
      } finally {
        setLoadingTeams(false);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    loadEventPlayers(form.event);
  }, [form.event, loadEventPlayers]);
  useEffect(() => {
    loadEventTeams(form.event, form.match_type);
  }, [form.event, form.match_type, loadEventTeams]);

  // ── When a team is picked, write its players into form ────────────────────
  const handleTeam1Change = (teamId) => {
    setSelectedTeam1Id(teamId);
    const team = eventTeams.find((t) => String(t.id) === String(teamId));
    if (team) {
      setForm((f) => ({
        ...f,
        player1_team1: String(team.player1_id),
        player2_team1: String(team.player2_id),
      }));
    } else {
      setForm((f) => ({ ...f, player1_team1: "", player2_team1: "" }));
    }
  };

  const handleTeam2Change = (teamId) => {
    setSelectedTeam2Id(teamId);
    const team = eventTeams.find((t) => String(t.id) === String(teamId));
    if (team) {
      setForm((f) => ({
        ...f,
        player1_team2: String(team.player1_id),
        player2_team2: String(team.player2_id),
      }));
    } else {
      setForm((f) => ({ ...f, player1_team2: "", player2_team2: "" }));
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleEventChange = (e) => {
    const eventId = e.target.value;
    const evArr = Array.isArray(allEvents) ? allEvents : [];
    const chosen = evArr.find((ev) => String(ev.id) === eventId);
    setSelectedTeam1Id("");
    setSelectedTeam2Id("");
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
  // Use team-select mode when event has teams defined
  const useTeamMode = isDoubles && eventTeams.length > 0;

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
        <Select value={form.event} onChange={handleEventChange}>
          <option value="">— No event selected —</option>
          {evArr.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </Select>
      </div>

      {/* ── Player / team source banner ── */}
      {form.event && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 12,
            background: useTeamMode
              ? "rgba(255,160,80,0.07)"
              : playerSource === "registered"
                ? "rgba(200,255,0,0.06)"
                : "rgba(255,255,255,0.04)",
            border: `1px solid ${useTeamMode ? "rgba(255,160,80,0.2)" : playerSource === "registered" ? "rgba(200,255,0,0.2)" : "rgba(255,255,255,0.08)"}`,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {useTeamMode ? (
            <>
              <span style={{ color: "#fdba74", fontWeight: 600 }}>
                🤝 {eventTeams.length} teams available
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>
                — select a team to fill both player slots automatically
              </span>
            </>
          ) : loadingEventPlayers || loadingTeams ? (
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</span>
          ) : playerSource === "registered" ? (
            <>
              <span style={{ color: "#c8ff00", fontWeight: 600 }}>
                🎯 {playerOpts.length} registered players
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>
                — only these players appear below
              </span>
            </>
          ) : (
            <>
              <span style={{ color: "#fbbf24", fontWeight: 600 }}>
                ⚠ No registered players
              </span>
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: 4 }}>
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

      {/* ── Teams / Players ── */}
      {useTeamMode ? (
        /* ── TEAM SELECT MODE ── */
        <div style={S.teamGrid}>
          <div style={S.teamCol}>
            <div style={S.teamLabel}>Team 1</div>
            <FormField label="Select team">
              <Select
                value={selectedTeam1Id}
                onChange={(e) => handleTeam1Change(e.target.value)}
                required
              >
                <option value="">— Select team —</option>
                {eventTeams
                  .filter((t) => String(t.id) !== String(selectedTeam2Id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </FormField>
            {selectedTeam1Id &&
              (() => {
                const t = eventTeams.find(
                  (t) => String(t.id) === String(selectedTeam1Id),
                );
                return t ? (
                  <div style={S.teamPreview}>
                    <span style={S.teamPreviewChip}>{t.player1_name}</span>
                    <span style={S.teamPreviewSlash}>/</span>
                    <span style={S.teamPreviewChip}>{t.player2_name}</span>
                  </div>
                ) : null;
              })()}
          </div>

          <div style={S.vsCol}>vs</div>

          <div style={S.teamCol}>
            <div style={S.teamLabel}>Team 2</div>
            <FormField label="Select team">
              <Select
                value={selectedTeam2Id}
                onChange={(e) => handleTeam2Change(e.target.value)}
                required
              >
                <option value="">— Select team —</option>
                {eventTeams
                  .filter((t) => String(t.id) !== String(selectedTeam1Id))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </FormField>
            {selectedTeam2Id &&
              (() => {
                const t = eventTeams.find(
                  (t) => String(t.id) === String(selectedTeam2Id),
                );
                return t ? (
                  <div style={S.teamPreview}>
                    <span style={S.teamPreviewChip}>{t.player1_name}</span>
                    <span style={S.teamPreviewSlash}>/</span>
                    <span style={S.teamPreviewChip}>{t.player2_name}</span>
                  </div>
                ) : null;
              })()}
          </div>
        </div>
      ) : (
        /* ── INDIVIDUAL PLAYER MODE (singles or doubles without teams) ── */
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
      )}

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
  const [editLoading, setEditLoading] = useState(null); // holds ID of match being fetched

  const handleEdit = async (m) => {
    setEditLoading(m.id);
    try {
      const res = await authFetch(`/api/matches/${m.id}/`);
      const full = await res.json();
      setEditing(full);
    } catch {
      setEditing(m); // fallback to list data
    } finally {
      setEditLoading(null);
    }
  };
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const arr = Array.isArray(matches) ? matches : matches?.results || [];

  const filtered = arr.filter((m) => {
    const t1 = [m.player1_team1_name, m.player2_team1_name]
      .filter(Boolean)
      .join(" ");
    const t2 = [m.player1_team2_name, m.player2_team2_name]
      .filter(Boolean)
      .join(" ");
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      t1.toLowerCase().includes(q) ||
      t2.toLowerCase().includes(q) ||
      (m.event_name || "").toLowerCase().includes(q);
    const matchStatus = !filterStatus || m.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleDelete = async (m) => {
    const t1 =
      [m.player1_team1_name, m.player2_team1_name]
        .filter(Boolean)
        .join(" / ") || "this match";
    if (!confirm(`Delete match: ${t1}?`)) return;
    await authFetch(`/api/matches/${m.id}/`, { method: "DELETE" });
    refresh();
  };

  const live = arr.filter((m) => m.status === "Live").length;
  const upcoming = arr.filter((m) => m.status === "Upcoming").length;
  const completed = arr.filter((m) => m.status === "Completed").length;

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.topBar}>
        <div>
          <div style={S.title}>Matches</div>
          <div style={S.sub}>Schedule and manage all tournament matches</div>
        </div>
        <button style={S.createBtn} onClick={() => setShowCreate(true)}>
          + New match
        </button>
      </div>

      {/* Summary */}
      <div style={S.summaryRow}>
        {[
          { label: "Total", val: arr.length, clr: "#fff" },
          { label: "Live", val: live, clr: "#c8ff00" },
          { label: "Upcoming", val: upcoming, clr: "#4af" },
          { label: "Completed", val: completed, clr: "#6ee7b7" },
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
          placeholder="Search players, events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          style={S.search}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="Live">Live</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Header row */}
      <div style={S.headerRow}>
        <div style={S.hStatus} />
        <div style={S.hTeams}>Match</div>
        <div style={S.hMeta}>Event</div>
        <div style={S.hMeta}>Tournament</div>
        <div style={S.hMeta}>Type</div>
        <div style={S.hMeta}>Court</div>
        <div style={S.hMeta}>Time</div>
        <div style={S.hActions} />
      </div>

      {loading ? (
        <div style={S.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          {arr.length === 0
            ? "No matches yet."
            : "No matches match your search."}
        </div>
      ) : (
        <div style={S.list}>
          {filtered.map((m) => (
            <MatchRow
              key={m.id}
              m={m}
              onEdit={handleEdit}
              onDelete={handleDelete}
              editLoadingId={editLoading}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <Modal
          title="New match"
          onClose={() => setShowCreate(false)}
          width={600}
        >
          <MatchForm
            onSave={() => {
              setShowCreate(false);
              refresh();
            }}
            onClose={() => setShowCreate(false)}
          />
        </Modal>
      )}

      {editing && (
        <Modal title="Edit match" onClose={() => setEditing(null)} width={600}>
          <MatchForm
            initial={editing}
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
  input:focus, select:focus { outline: none; border-color: rgba(200,255,0,0.4) !important; }
  button:hover { opacity: 0.85; }
`;

const S = {
  page: { display: "flex", flexDirection: "column", gap: 24 },
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
  headerRow: {
    display: "grid",
    gridTemplateColumns: "16px 2fr 1fr 1fr 1fr 1fr 1fr 80px",
    gap: 12,
    padding: "0 14px",
    alignItems: "center",
  },
  hStatus: {},
  hTeams: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  hMeta: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    fontWeight: 600,
    textTransform: "uppercase",
  },
  hActions: {},
  list: { display: "flex", flexDirection: "column", gap: 6 },
  empty: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    padding: "48px 0",
    textAlign: "center",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "16px 2fr 1fr 1fr 1fr 1fr 1fr 80px",
    gap: 12,
    padding: "12px 14px",
    background: "#111",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 10,
    alignItems: "center",
  },
  statusDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  rowTeams: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  teamName: { fontSize: 13, color: "#fff", fontWeight: 500 },
  rowVs: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  rowMeta: { fontSize: 12, color: "rgba(255,255,255,0.4)" },
  eventTag: {
    background: "rgba(200,255,0,0.08)",
    color: "#c8ff00",
    borderRadius: 4,
    padding: "2px 7px",
    fontSize: 11,
    fontWeight: 600,
  },
  pin: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 4,
    padding: "2px 7px",
  },
  rowActions: { display: "flex", gap: 6 },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "5px 10px",
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
  eventPickerBox: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  eventPickerLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "#c8ff00",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  eventPickerSub: { fontSize: 12, color: "rgba(255,255,255,0.35)" },
  teamGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 28px 1fr",
    gap: 0,
    alignItems: "start",
  },
  teamCol: { display: "flex", flexDirection: "column", gap: 10 },
  teamLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    paddingBottom: 4,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  vsCol: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.2)",
    fontSize: 13,
    paddingTop: 28,
  },
  // Team preview chips (shown after team selection)
  teamPreview: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    background: "rgba(255,160,80,0.07)",
    borderRadius: 7,
    border: "1px solid rgba(255,160,80,0.15)",
  },
  teamPreviewChip: { fontSize: 12, color: "rgba(255,255,255,0.7)" },
  teamPreviewSlash: { color: "#fdba74", fontSize: 12 },
};
