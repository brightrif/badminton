// src/pages/director/EventBracket.jsx
//
// Bracket layout for 12 teams (draw_size=16, 4 byes):
//
//  R1 (Round of 16)          QF              SF         Final
//  ┌─────────────┐
//  │ Team A      │
//  │ Team B      │ ──winner──►┐
//  │ Not sched   │            │
//  │ [Assign]    │            ├──►┐
//  └─────────────┘            │   │
//  ┌─────────────┐            │   │
//  │ Team C      │            │   │
//  │ (BYE) ——    │ ──auto──►──┘   │
//  │ BYE         │                │
//  │ [Assign Bye]│                ├──► ...
//  └─────────────┘                │
//  ...                            │

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import Modal, { FormField, Input, Select } from "../../components/Modal";

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

// ─── Assign Entries Modal ─────────────────────────────────────────────────────

function AssignEntriesModal({ bm, event, allBms, isByeMode, onSave, onClose }) {
  const { authFetch } = useAuth();
  const isDoubles = event.match_type !== "SINGLE";
  const allEntries = event.entries || [];
  // isByeMode comes from the button clicked — overrides bm.is_bye
  // so any R1 slot can be used as a bye or a real match
  const isByeSlot = isByeMode ?? bm.is_bye;

  const [entry1, setEntry1] = useState(bm.entry1 ? String(bm.entry1) : "");
  const [entry2, setEntry2] = useState(bm.entry2 ? String(bm.entry2) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Teams already used anywhere in the bracket (exclude current slot)
  const usedAnywhere = new Set(
    (allBms || [])
      .filter((s) => s.id !== bm.id)
      .flatMap((s) => [s.entry1, s.entry2, s.entry1_player, s.entry2_player])
      .filter(Boolean)
      .map(String),
  );

  const available = allEntries.filter(
    (t) =>
      !usedAnywhere.has(String(t.id)) ||
      String(t.id) === entry1 ||
      String(t.id) === entry2,
  );

  const handleSave = async () => {
    if (!isByeSlot && (!entry1 || !entry2)) {
      setError("Please select both teams.");
      return;
    }
    if (isByeSlot && !entry1) {
      setError("Please select the bye team.");
      return;
    }
    if (!isByeSlot && entry1 === entry2) {
      setError("Team 1 and Team 2 must be different.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const body = { is_bye: isByeSlot };
      if (isByeSlot) {
        // Bye slot: only entry1 (the team that advances directly)
        isDoubles
          ? (body.entry1 = Number(entry1))
          : (body.entry1_player = Number(entry1));
      } else {
        // Normal R1 slot: both entries
        if (isDoubles) {
          body.entry1 = Number(entry1);
          body.entry2 = Number(entry2);
        } else {
          body.entry1_player = Number(entry1);
          body.entry2_player = Number(entry2);
        }
      }

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
        {isByeSlot
          ? "Select the team that receives a bye — they advance directly to the next round without playing."
          : "Assign which two teams play in this slot."}
      </div>

      {/* Entry 1 — always shown */}
      <FormField
        label={
          isByeSlot
            ? isDoubles
              ? "Bye Team"
              : "Bye Player"
            : isDoubles
              ? "Team 1 (Side A)"
              : "Player 1"
        }
      >
        <Select value={entry1} onChange={(e) => setEntry1(e.target.value)}>
          <option value="">— Select —</option>
          {available.map((t) => (
            <option
              key={t.id}
              value={t.id}
              disabled={!isByeSlot && String(t.id) === entry2}
            >
              {t.display_name}
            </option>
          ))}
        </Select>
      </FormField>

      {/* Entry 2 — only for real R1 slots */}
      {!isByeSlot && (
        <FormField label={isDoubles ? "Team 2 (Side B)" : "Player 2"}>
          <Select value={entry2} onChange={(e) => setEntry2(e.target.value)}>
            <option value="">— Select —</option>
            {available.map((t) => (
              <option
                key={t.id}
                value={t.id}
                disabled={String(t.id) === entry1}
              >
                {t.display_name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
        }}
      >
        <button type="button" style={S.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            background: isByeSlot ? "#fdba74" : "#c8ff00",
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
          {saving ? "Assigning…" : isByeSlot ? "Assign Bye" : "Assign"}
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
          {saving ? "Saving…" : existing ? "Update Schedule" : "Schedule Match"}
        </button>
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({ bm, event, allBms, onAssign, onSchedule }) {
  const m = bm.match_detail;
  const isByeSlot = bm.is_bye;

  const entry1Filled = bm.entry1_name && bm.entry1_name !== "TBD";
  const entry2Filled =
    bm.entry2_name && bm.entry2_name !== "TBD" && bm.entry2_name !== "—";
  const bothAssigned = entry1Filled && entry2Filled;
  const isR1 = bm.round_number === 1;
  const isUnassigned = !m && (!entry1Filled || (!isByeSlot && !entry2Filled));

  const t1won = m?.status === "Completed" && m.team1_sets > m.team2_sets;
  const t2won = m?.status === "Completed" && m.team2_sets > m.team1_sets;
  const clr = STATUS_CLR[m?.status] || "rgba(80,80,100,0.8)";

  // Card border/bg varies: bye=orange tint, normal=default, r2+ tbd=faded
  const cardStyle = {
    ...S.card,
    ...(isByeSlot
      ? {
          borderColor: "rgba(255,160,80,0.25)",
          background: "rgba(255,160,80,0.04)",
        }
      : {}),
    ...(!bothAssigned && !isByeSlot && bm.round_number > 1 ? S.cardTbd : {}),
  };

  return (
    <div style={cardStyle}>
      {/* Entry 1 */}
      <div style={{ ...S.entry, ...(t1won ? S.entryWon : {}) }}>
        <span
          style={{
            ...S.entryName,
            color:
              isByeSlot && entry1Filled
                ? "#fdba74"
                : isByeSlot && !entry1Filled
                  ? "rgba(255,255,255,0.3)"
                  : "#fff",
          }}
        >
          {isByeSlot && !entry1Filled ? "— Bye Team —" : bm.entry1_name}
        </span>
        {m?.status === "Completed" && (
          <span style={S.sets}>{m.team1_sets}</span>
        )}
      </div>

      <div style={S.cardDivider} />

      {/* Entry 2 — shows "advances directly" for bye slots */}
      <div
        style={{
          ...S.entry,
          ...(t2won ? S.entryWon : {}),
          borderBottom: "none",
        }}
      >
        {isByeSlot ? (
          <span
            style={{
              fontSize: 10,
              color: "rgba(255,160,80,0.5)",
              fontStyle: "italic",
            }}
          >
            advances directly →
          </span>
        ) : (
          <>
            <span style={S.entryName}>{bm.entry2_name}</span>
            {m?.status === "Completed" && (
              <span style={S.sets}>{m.team2_sets}</span>
            )}
          </>
        )}
      </div>

      {/* Status strip */}
      <div
        style={{
          ...S.statusStrip,
          background: isByeSlot ? "rgba(255,160,80,0.35)" : clr,
          color: "rgba(0,0,0,0.75)",
        }}
      >
        {isByeSlot
          ? "BYE"
          : m?.scheduled_time
            ? new Date(m.scheduled_time).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : m?.status || "Not scheduled"}
        {!isByeSlot && m?.court_name && (
          <span style={{ marginLeft: 5, opacity: 0.7 }}>· {m.court_name}</span>
        )}
      </div>

      {/* Actions */}
      <div style={S.cardActions}>
        {/* R1 unassigned: show BOTH Assign and Assign Bye buttons */}
        {isR1 && isUnassigned && (
          <>
            <button style={S.assignBtn} onClick={() => onAssign(bm, false)}>
              Assign
            </button>
            <button
              style={{
                ...S.assignBtn,
                background: "rgba(255,160,80,0.12)",
                color: "#fdba74",
                borderColor: "rgba(255,160,80,0.3)",
              }}
              onClick={() => onAssign(bm, true)}
            >
              Bye
            </button>
          </>
        )}

        {/* R1 bye slot assigned — show "✓" and allow re-assign */}
        {isR1 && isByeSlot && entry1Filled && (
          <div
            style={{ display: "flex", gap: 4, flex: 1, alignItems: "center" }}
          >
            <span
              style={{
                fontSize: 10,
                color: "rgba(255,160,80,0.6)",
                flex: 1,
                paddingLeft: 4,
              }}
            >
              ✓ bye
            </span>
            <button
              style={{ ...S.editBtn, fontSize: 9 }}
              onClick={() => onAssign(bm, true)}
            >
              Change
            </button>
          </div>
        )}

        {/* R1 real slot assigned — show Schedule */}
        {isR1 && !isByeSlot && bothAssigned && (
          <button
            style={m ? S.editBtn : S.scheduleBtn}
            onClick={() => onSchedule(bm)}
          >
            {m ? "✎ Edit" : "Schedule"}
          </button>
        )}

        {/* R2+ slots — schedule when both filled */}
        {!isR1 && bothAssigned && (
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
  const [isByeMode, setIsByeMode] = useState(false);
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
                        allBms={bracketMatches}
                        onAssign={(bm, asBye) => {
                          setAssigningBm(bm);
                          setIsByeMode(asBye);
                        }}
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

      {/* Assign modal */}
      {assigningBm && (
        <Modal
          title={
            isByeMode
              ? `Assign Bye — Slot ${assigningBm.position}`
              : `Assign — Round 1 · Slot ${assigningBm.position}`
          }
          onClose={() => {
            setAssigningBm(null);
            setIsByeMode(false);
          }}
          width={460}
        >
          <AssignEntriesModal
            bm={assigningBm}
            event={event}
            allBms={bracketMatches}
            isByeMode={isByeMode}
            onSave={() => {
              setAssigningBm(null);
              setIsByeMode(false);
              onRefresh();
            }}
            onClose={() => {
              setAssigningBm(null);
              setIsByeMode(false);
            }}
          />
        </Modal>
      )}

      {/* Schedule modal */}
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
    if (!confirm("Reset the bracket? All assignments will be cleared.")) return;
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
  const r1Real = bms.filter((b) => b.round_number === 1 && !b.is_bye);
  const r1Total = r1Real.length;
  const r1Assigned = r1Real.filter((b) => b.entry1 || b.entry1_player).length;
  const byeCount = event.bye_count || 0;

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
            {byeCount > 0 && (
              <span style={{ color: "#fdba74", marginLeft: 8 }}>
                · {byeCount} bye{byeCount > 1 ? "s" : ""}
              </span>
            )}
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

      {/* Pills */}
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
        <div style={S.notDrawn}>
          <div style={{ fontSize: 52 }}>🏆</div>
          <div style={S.notDrawnTitle}>Bracket not generated yet</div>
          <div style={S.notDrawnSub}>
            {event.entry_count} entries registered.
            {event.entry_count > 0 &&
              !isPowerOf2(event.entry_count) &&
              ` ${nextPow2(event.entry_count) - event.entry_count} team(s) will receive byes and advance directly to Round 2.`}
          </div>
          <button
            style={S.generateBtn}
            onClick={handleGenerate}
            disabled={generating || event.entry_count < 2}
          >
            {generating ? "Generating…" : "⚡ Generate Bracket"}
          </button>
        </div>
      ) : (
        <>
          {r1Assigned < r1Total && (
            <div style={S.guideBanner}>
              <strong style={{ color: "#fdba74" }}>
                Assign Round 1 slots:
              </strong>{" "}
              Click <strong>Assign</strong> on each match slot.
              {byeCount > 0 && (
                <>
                  {" "}
                  For the{" "}
                  <strong style={{ color: "#fdba74" }}>
                    {byeCount} bye slot{byeCount > 1 ? "s" : ""}
                  </strong>
                  , click <strong>Assign Bye</strong> — that team advances
                  directly to Round 2.
                </>
              )}
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

function isPowerOf2(n) {
  return n > 0 && (n & (n - 1)) === 0;
}
function nextPow2(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
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
    maxWidth: 115,
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
    minHeight: 30,
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
