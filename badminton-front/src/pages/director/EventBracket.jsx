// src/pages/director/EventBracket.jsx
//
// Full knockout bracket management page.
//
// Director workflow:
//   1. "Generate Bracket"  — POST /api/events/{id}/generate_bracket/
//   2. R1 slots: "Assign"  — POST /api/bracket-matches/{id}/set_entries/
//   3. Any slot with both entries: "Schedule" — POST /api/bracket-matches/{id}/schedule_match/
//   4. Matches complete  →  system auto-fills next round entries
//   5. Director only needs to "Schedule" (set date/court) for subsequent rounds

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import Modal, {
  FormField,
  Input,
  Select,
  SubmitBtn,
} from "../../components/Modal";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByRound(bms) {
  return bms.reduce((acc, bm) => {
    if (!acc[bm.round_number]) acc[bm.round_number] = [];
    acc[bm.round_number].push(bm);
    return acc;
  }, {});
}

function roundName(roundNum, totalRounds) {
  const fromEnd = totalRounds - roundNum + 1;
  return (
    {
      1: "Final",
      2: "Semi-Final",
      3: "Quarter-Final",
      4: "Round of 16",
      5: "Round of 32",
    }[fromEnd] || `Round ${roundNum}`
  );
}

const STATUS_CLR = {
  Live: "#c8ff00",
  Completed: "#6ee7b7",
  Upcoming: "#60a5fa",
};

// ─── Assign Entries Modal (R1 only) ──────────────────────────────────────────

function AssignEntriesModal({ bm, event, onSave, onClose }) {
  const { authFetch } = useAuth();
  const isDoubles = event.match_type !== "SINGLE";
  const allEntries = event.entries || [];
  const [entry1, setEntry1] = useState(bm.entry1 ? String(bm.entry1) : "");
  const [entry2, setEntry2] = useState(bm.entry2 ? String(bm.entry2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // IDs already assigned in OTHER R1 slots
  const usedIds = new Set(
    (event.bracket_matches || [])
      .filter((s) => s.id !== bm.id && s.round_number === 1)
      .flatMap((s) => [s.entry1, s.entry2, s.entry1_player, s.entry2_player])
      .filter(Boolean)
      .map(String),
  );

  const available = allEntries.filter(
    (t) =>
      !usedIds.has(String(t.id)) ||
      String(t.id) === entry1 ||
      String(t.id) === entry2,
  );

  const handleSave = async () => {
    if (!entry1 || !entry2) {
      setError("Please select both entries.");
      return;
    }
    if (entry1 === entry2) {
      setError("Entry 1 and Entry 2 must be different.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = isDoubles
        ? { entry1: Number(entry1), entry2: Number(entry2) }
        : { entry1_player: Number(entry1), entry2_player: Number(entry2) };
      const res = await authFetch(
        `/api/bracket-matches/${bm.id}/set_entries/`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Object.values(d).flat().join(" "));
      }
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div style={S.errBox}>{error}</div>}
      <div
        style={{
          fontSize: 13,
          color: "rgba(255,255,255,0.45)",
          lineHeight: 1.5,
        }}
      >
        Assign who plays in this Round 1 slot. Each entry can only appear once.
      </div>
      <FormField label={isDoubles ? "Team 1 (Side A)" : "Player 1"}>
        <Select value={entry1} onChange={(e) => setEntry1(e.target.value)}>
          <option value="">— Select —</option>
          {available.map((t) => (
            <option key={t.id} value={t.id} disabled={String(t.id) === entry2}>
              {t.display_name}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label={isDoubles ? "Team 2 (Side B)" : "Player 2"}>
        <Select value={entry2} onChange={(e) => setEntry2(e.target.value)}>
          <option value="">— Select —</option>
          {available.map((t) => (
            <option key={t.id} value={t.id} disabled={String(t.id) === entry1}>
              {t.display_name}
            </option>
          ))}
        </Select>
      </FormField>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        {/* <button style={S.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <SubmitBtn loading={saving} onClick={handleSave}>
          Assign
        </SubmitBtn> */}
        <button type="button" style={S.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "#c8ff00",
            color: "#0a0a0a",
            border: "none",
            borderRadius: 10,
            padding: "13px 24px",
            fontSize: 14,
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : "Assign"}
        </button>
      </div>
    </div>
  );
}

// ─── Schedule Match Modal ─────────────────────────────────────────────────────

function ScheduleMatchModal({ bm, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: venues } = useApi("/api/venues/");
  const { data: courts } = useApi("/api/courts/");
  const existing = bm.match_detail;

  const [form, setForm] = useState({
    scheduled_time: existing?.scheduled_time
      ? new Date(existing.scheduled_time).toISOString().slice(0, 16)
      : "",
    venue: "",
    court: "",
    scoring_format: "21_WITH_SET",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const venueOpts = Array.isArray(venues) ? venues : [];
  const courtOpts = Array.isArray(courts) ? courts : [];

  const handleSave = async () => {
    if (!form.scheduled_time) {
      setError("Scheduled time is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await authFetch(
        `/api/bracket-matches/${bm.id}/schedule_match/`,
        {
          method: "POST",
          body: JSON.stringify({
            scheduled_time: form.scheduled_time,
            ...(form.venue && { venue: Number(form.venue) }),
            ...(form.court && { court: Number(form.court) }),
            scoring_format: form.scoring_format,
          }),
        },
      );
      if (!res.ok) {
        const d = await res.json();
        throw new Error(Object.values(d).flat().join(" "));
      }
      onSave();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div style={S.errBox}>{error}</div>}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "8px 0",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
          {bm.entry1_name}
        </span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>vs</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
          {bm.entry2_name}
        </span>
      </div>
      <FormField label="Date & time">
        <Input
          type="datetime-local"
          value={form.scheduled_time}
          onChange={set("scheduled_time")}
          required
        />
      </FormField>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <FormField label="Venue (optional)">
          <Select value={form.venue} onChange={set("venue")}>
            <option value="">— Select —</option>
            {venueOpts.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Court (optional)">
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
      <FormField label="Scoring format">
        <Select value={form.scoring_format} onChange={set("scoring_format")}>
          <option value="21_WITH_SET">21 pts — settings to 30</option>
          <option value="21_NO_SET">21 pts — no settings</option>
          <option value="15_WITH_SET">15 pts — settings to 21</option>
          <option value="15_NO_SET">15 pts — no settings</option>
        </Select>
      </FormField>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <button style={S.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <SubmitBtn loading={saving} onClick={handleSave}>
          {existing ? "Update Schedule" : "Schedule Match"}
        </SubmitBtn>
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ bm, event, isR1, onAssign, onSchedule }) {
  const m = bm.match_detail;
  const isBye = bm.is_bye;
  const bothAssigned =
    bm.entry1_name !== "TBD" && bm.entry2_name !== "TBD" && !isBye;
  const t1won = m?.status === "Completed" && m.team1_sets > m.team2_sets;
  const t2won = m?.status === "Completed" && m.team2_sets > m.team1_sets;
  const clr = STATUS_CLR[m?.status] || "rgba(80,80,100,0.8)";

  return (
    <div style={{ ...S.card, ...(!bothAssigned && !isR1 ? S.cardTbd : {}) }}>
      {/* Entry 1 */}
      <div style={{ ...S.entry, ...(t1won ? S.entryWon : {}) }}>
        <span style={S.entryName}>{bm.entry1_name}</span>
        {m?.status === "Completed" && (
          <span style={S.sets}>{m.team1_sets}</span>
        )}
      </div>

      <div style={S.cardDivider} />

      {/* Entry 2 */}
      <div
        style={{
          ...S.entry,
          ...(t2won ? S.entryWon : {}),
          borderBottom: "none",
        }}
      >
        <span style={S.entryName}>{isBye ? "BYE" : bm.entry2_name}</span>
        {m?.status === "Completed" && (
          <span style={S.sets}>{m.team2_sets}</span>
        )}
      </div>

      {/* Status / time strip */}
      <div style={{ ...S.statusStrip, background: clr }}>
        {isBye
          ? "BYE"
          : m?.scheduled_time
            ? new Date(m.scheduled_time).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : m?.status || "Not scheduled"}
        {m?.court_name && (
          <span style={{ marginLeft: 5, opacity: 0.7 }}>· {m.court_name}</span>
        )}
      </div>

      {/* Action buttons */}
      <div style={S.cardActions}>
        {isR1 && !isBye && !m && (
          <button style={S.assignBtn} onClick={() => onAssign(bm)}>
            Assign
          </button>
        )}
        {bothAssigned && (
          <button
            style={m ? S.editBtn : S.scheduleBtn}
            onClick={() => onSchedule(bm)}
          >
            {m ? "✎ Edit" : "Schedule"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Knockout Bracket ─────────────────────────────────────────────────────────

function KnockoutBracket({ event, bracketMatches, onRefresh }) {
  const rounds = groupByRound(bracketMatches);
  const roundNums = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => a - b);
  const totalRounds = roundNums.length;

  const [assigningBm, setAssigningBm] = useState(null);
  const [schedulingBm, setSchedulingBm] = useState(null);

  return (
    <>
      <div style={S.bracketScroll}>
        <div style={S.bracket}>
          {roundNums.map((rnd) => {
            const bms = rounds[rnd].sort((a, b) => a.position - b.position);
            return (
              <div key={rnd} style={S.roundCol}>
                <div style={S.roundHeader}>{roundName(rnd, totalRounds)}</div>
                <div
                  style={{
                    ...S.roundSlots,
                    justifyContent:
                      bms.length === 1 ? "center" : "space-around",
                  }}
                >
                  {bms.map((bm) => (
                    <div key={bm.id} style={S.matchWrap}>
                      <MatchCard
                        bm={bm}
                        event={event}
                        isR1={rnd === 1}
                        onAssign={setAssigningBm}
                        onSchedule={setSchedulingBm}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Champion */}
          <div style={{ ...S.roundCol, minWidth: 130 }}>
            <div style={S.roundHeader}>Champion</div>
            <div
              style={{
                ...S.roundSlots,
                justifyContent: "center",
                paddingTop: 40,
              }}
            >
              {(() => {
                const finalBm = bracketMatches.find(
                  (b) => b.round_number === totalRounds,
                );
                const w =
                  finalBm?.match_detail?.status === "Completed"
                    ? finalBm.match_detail.team1_sets >
                      finalBm.match_detail.team2_sets
                      ? finalBm.entry1_name
                      : finalBm.entry2_name
                    : null;
                return (
                  <div style={S.champion}>
                    <div style={{ fontSize: 28 }}>🥇</div>
                    <div style={S.champName}>{w || "TBD"}</div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {assigningBm && (
        <Modal
          title={`Assign — Round 1 · Slot ${assigningBm.position}`}
          onClose={() => setAssigningBm(null)}
          width={460}
        >
          <AssignEntriesModal
            bm={assigningBm}
            event={event}
            onSave={() => {
              setAssigningBm(null);
              onRefresh();
            }}
            onClose={() => setAssigningBm(null)}
          />
        </Modal>
      )}

      {schedulingBm && (
        <Modal
          title={`Schedule — ${schedulingBm.entry1_name} vs ${schedulingBm.entry2_name}`}
          onClose={() => setSchedulingBm(null)}
          width={460}
        >
          <ScheduleMatchModal
            bm={schedulingBm}
            onSave={() => {
              setSchedulingBm(null);
              onRefresh();
            }}
            onClose={() => setSchedulingBm(null)}
          />
        </Modal>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EventBracket() {
  const { id } = useParams();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/api/events/${id}/bracket/`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load bracket.");
      setEvent(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async () => {
    if (
      !confirm(
        "Generate the knockout bracket? You can reset it later if no matches have been played.",
      )
    )
      return;
    setGenerating(true);
    try {
      const res = await authFetch(`/api/events/${id}/generate_bracket/`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = async () => {
    if (
      !confirm(
        "Reset the bracket? All assignments will be cleared. This fails if any match has been played.",
      )
    )
      return;
    setResetting(true);
    try {
      const res = await authFetch(`/api/events/${id}/reset_bracket/`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await load();
    } catch (e) {
      alert(e.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div style={S.loading}>Loading bracket…</div>;
  if (error) return <div style={S.errBox}>{error}</div>;
  if (!event) return null;

  const bms = event.bracket_matches || [];
  const total = bms.filter((b) => !b.is_bye).length;
  const played = bms.filter(
    (b) => b.match_detail?.status === "Completed",
  ).length;
  const r1Total = bms.filter((b) => b.round_number === 1 && !b.is_bye).length;
  const r1Assigned = bms.filter(
    (b) => b.round_number === 1 && !b.is_bye && (b.entry1 || b.entry1_player),
  ).length;

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate("/director/events")}>
          ← Events
        </button>
        <div style={{ flex: 1 }}>
          <div style={S.title}>{event.name}</div>
          <div style={S.sub}>
            {event.tournament_name} · Knockout · {event.entry_count} entries
          </div>
        </div>
        {event.is_drawn && (
          <div style={S.progressWrap}>
            <div style={S.progressBar}>
              <div
                style={{
                  ...S.progressFill,
                  width: total ? `${(played / total) * 100}%` : "0%",
                }}
              />
            </div>
            <div style={S.progressText}>
              {played}/{total} matches played
            </div>
          </div>
        )}
      </div>

      {/* Status pills */}
      {event.is_drawn && (
        <div style={S.pillRow}>
          {[
            {
              label: "R1 assigned",
              val: `${r1Assigned}/${r1Total}`,
              clr: "#c8ff00",
            },
            {
              label: "scheduled",
              val: bms.filter((b) => b.match_detail?.status === "Upcoming")
                .length,
              clr: "#60a5fa",
            },
            {
              label: "live",
              val: bms.filter((b) => b.match_detail?.status === "Live").length,
              clr: "#c8ff00",
            },
            { label: "completed", val: played, clr: "#6ee7b7" },
          ].map(({ label, val, clr }) => (
            <div key={label} style={S.pill}>
              <span style={{ color: clr, fontWeight: 700, fontSize: 16 }}>
                {val}
              </span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {!event.is_drawn ? (
        /* ── Not generated yet ── */
        <div style={S.notDrawn}>
          <div style={{ fontSize: 52 }}>🏆</div>
          <div style={S.notDrawnTitle}>Bracket not generated yet</div>
          <div style={S.notDrawnSub}>
            {event.entry_count} entries registered. Generate the bracket to
            create all round slots, then assign which team plays in each Round 1
            slot and schedule their match times.
          </div>
          <button
            style={S.generateBtn}
            onClick={handleGenerate}
            disabled={generating || event.entry_count < 2}
          >
            {generating ? "Generating…" : "⚡ Generate Bracket"}
          </button>
          {event.entry_count < 2 && (
            <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>
              Need at least 2 entries to generate a bracket.
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Director guide ── */}
          {r1Assigned < r1Total && (
            <div style={S.guideBanner}>
              <strong style={{ color: "#fdba74" }}>
                Step 1 — Assign Round 1:
              </strong>{" "}
              Click <strong>Assign</strong> on each Round 1 card to choose which
              teams play. From Round 2 onwards the system fills teams
              automatically once R1 results are in. Then click{" "}
              <strong>Schedule</strong> on any filled card to set the date and
              court.
            </div>
          )}
          {r1Assigned === r1Total && played < r1Total && (
            <div style={S.guideBanner}>
              <strong style={{ color: "#c8ff00" }}>
                All Round 1 slots assigned.
              </strong>{" "}
              Click <strong>Schedule</strong> on each match to set the date and
              court. As Round 1 results come in, the system will automatically
              populate Round 2 slots.
            </div>
          )}

          <KnockoutBracket
            event={event}
            bracketMatches={bms}
            onRefresh={load}
          />

          <div style={S.resetZone}>
            <button
              style={S.resetBtn}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "Resetting…" : "Reset Bracket"}
            </button>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
              Clears all slot assignments. Only allowed if no matches have been
              played yet.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  button:hover { opacity: 0.85; }
  ::-webkit-scrollbar { height: 5px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
`;

const S = {
  page: {
    fontFamily: "'DM Sans', sans-serif",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  loading: {
    color: "rgba(255,255,255,0.4)",
    padding: "40px 0",
    textAlign: "center",
  },
  errBox: {
    background: "rgba(255,80,80,0.1)",
    border: "1px solid rgba(255,80,80,0.2)",
    borderRadius: 8,
    padding: "14px 18px",
    color: "#ff8080",
    fontSize: 13,
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  backBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "8px 14px",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    cursor: "pointer",
    marginTop: 4,
    flexShrink: 0,
  },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 28,
    color: "#fff",
  },
  sub: { fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 3 },

  progressWrap: { marginLeft: "auto", textAlign: "right", flexShrink: 0 },
  progressBar: {
    width: 160,
    height: 4,
    background: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "#c8ff00",
    borderRadius: 2,
    transition: "width 0.4s",
  },
  progressText: { fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 4 },

  pillRow: { display: "flex", gap: 10, flexWrap: "wrap" },
  pill: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    padding: "8px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    alignItems: "center",
  },

  guideBanner: {
    background: "rgba(255,200,80,0.06)",
    border: "1px solid rgba(255,200,80,0.15)",
    borderRadius: 8,
    padding: "11px 16px",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 1.6,
  },

  notDrawn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "60px 20px",
    textAlign: "center",
  },
  notDrawnTitle: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 22,
    color: "#fff",
  },
  notDrawnSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.4)",
    maxWidth: 420,
    lineHeight: 1.7,
  },
  generateBtn: {
    background: "#c8ff00",
    color: "#0a0a0a",
    border: "none",
    borderRadius: 10,
    padding: "12px 28px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },

  bracketScroll: { overflowX: "auto", paddingBottom: 16 },
  bracket: {
    display: "flex",
    gap: 0,
    alignItems: "flex-start",
    minWidth: "max-content",
  },
  roundCol: { display: "flex", flexDirection: "column", gap: 0, minWidth: 180 },
  roundHeader: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    textAlign: "center",
    padding: "0 8px 12px",
  },
  roundSlots: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "0 6px",
    flex: 1,
  },
  matchWrap: { display: "flex", flexDirection: "column" },

  card: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    overflow: "hidden",
    width: 164,
  },
  cardTbd: { opacity: 0.4 },
  entry: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 10px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    minHeight: 32,
  },
  entryWon: { background: "rgba(200,255,0,0.07)" },
  entryName: {
    fontSize: 12,
    color: "#fff",
    fontWeight: 500,
    maxWidth: 110,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sets: { fontSize: 13, fontWeight: 700, color: "#c8ff00", marginLeft: 6 },
  cardDivider: { height: 1, background: "rgba(255,255,255,0.06)" },
  statusStrip: {
    fontSize: 10,
    padding: "3px 8px",
    color: "rgba(0,0,0,0.75)",
    fontWeight: 600,
    textAlign: "center",
  },
  cardActions: {
    display: "flex",
    gap: 4,
    padding: "5px 6px",
    background: "rgba(255,255,255,0.02)",
  },
  assignBtn: {
    flex: 1,
    background: "rgba(200,255,0,0.1)",
    color: "#c8ff00",
    border: "1px solid rgba(200,255,0,0.2)",
    borderRadius: 4,
    padding: "4px 0",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
  },
  scheduleBtn: {
    flex: 1,
    background: "rgba(96,165,250,0.1)",
    color: "#60a5fa",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: 4,
    padding: "4px 0",
    fontSize: 10,
    fontWeight: 600,
    cursor: "pointer",
  },
  editBtn: {
    flex: 1,
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.4)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 4,
    padding: "4px 0",
    fontSize: 10,
    cursor: "pointer",
  },

  champion: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "16px 12px",
    background: "rgba(200,255,0,0.04)",
    border: "1px solid rgba(200,255,0,0.1)",
    borderRadius: 8,
    minWidth: 120,
  },
  champName: {
    fontSize: 13,
    fontWeight: 600,
    color: "#c8ff00",
    textAlign: "center",
  },

  cancelBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "9px 16px",
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    cursor: "pointer",
  },

  resetZone: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "16px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    marginTop: 8,
  },
  resetBtn: {
    background: "rgba(255,60,60,0.08)",
    color: "#f87171",
    border: "1px solid rgba(255,60,60,0.2)",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 12,
    cursor: "pointer",
  },
};
