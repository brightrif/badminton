// src/components/director/BreakModePanel.jsx

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";

// ── Single court row ──────────────────────────────────────────────────────────
function CourtBreakRow({ court, onToggle, onModeChange, onVideoUpload, busy }) {
  const fileRef = useRef(null);
  const isOn = court.break_mode;
  const mode = court.break_display_mode ?? "sponsors";

  return (
    <div style={{ ...R.row, ...(isOn ? R.rowActive : {}) }}>
      {/* Court identity */}
      <div style={R.identity}>
        <div style={R.courtName}>{court.name}</div>
        <div style={R.courtSlug}>/screen/court/{court.slug}</div>
      </div>

      {/* ── Mode selector (Sponsors | Video) — only relevant controls shown */}
      <div style={R.modeGroup}>
        <button
          style={{
            ...R.modeBtn,
            ...(mode === "sponsors" ? R.modeBtnActive : {}),
          }}
          onClick={() => !busy && onModeChange(court, "sponsors")}
          title="Show sponsor showcase on break screen"
        >
          🏷 Sponsors
        </button>
        <button
          style={{ ...R.modeBtn, ...(mode === "video" ? R.modeBtnActive : {}) }}
          onClick={() => !busy && onModeChange(court, "video")}
          title="Play ad video on break screen"
        >
          🎬 Video
        </button>
      </div>

      {/* Video status + upload (always visible so director can pre-upload) */}
      <div style={R.videoArea}>
        {court.break_video_url ? (
          <span style={R.videoReady}>✓ Video ready</span>
        ) : (
          <span style={R.videoMissing}>No video</span>
        )}
        <button
          style={R.uploadBtn}
          disabled={!!busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy === "upload" ? "Uploading…" : "📤 Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onVideoUpload(court, f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Break mode toggle */}
      <button
        style={{ ...R.toggleBtn, ...(isOn ? R.toggleOn : R.toggleOff) }}
        onClick={() => !busy && onToggle(court, !isOn)}
        disabled={!!busy}
      >
        <span style={R.dot(isOn)} />
        {busy === "toggle" ? "…" : isOn ? "🔴 ON" : "OFF"}
      </button>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function BreakModePanel() {
  const { authFetch } = useAuth();

  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({}); // { [courtId]: "toggle" | "upload" | "mode" }
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const loadCourts = async () => {
    try {
      const res = await authFetch("/api/courts/");
      const data = await res.json();
      setCourts(Array.isArray(data) ? data : (data.results ?? []));
    } catch {
      setCourts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourts();
  }, []);

  // ── Patch helper ────────────────────────────────────────────────────────
  const patchBreakMode = async (court, payload, busyKey) => {
    setBusy((b) => ({ ...b, [court.id]: busyKey }));
    try {
      const isFormData = payload instanceof FormData;
      const res = await authFetch(`/api/courts/${court.id}/break_mode/`, {
        method: "PATCH",
        headers: isFormData ? {} : { "Content-Type": "application/json" },
        body: isFormData ? payload : JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed");
      await loadCourts();
    } catch {
      showToast("⚠️ Action failed — please try again.");
    } finally {
      setBusy((b) => {
        const n = { ...b };
        delete n[court.id];
        return n;
      });
    }
  };

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleToggle = (court, active) => {
    patchBreakMode(
      court,
      { active, display_mode: court.break_display_mode ?? "sponsors" },
      "toggle",
    );
    showToast(
      active ? `☕ Break ON — ${court.name}` : `✅ Break OFF — ${court.name}`,
    );
  };

  const handleModeChange = (court, display_mode) => {
    patchBreakMode(court, { active: court.break_mode, display_mode }, "mode");
    showToast(
      `Switched to ${display_mode === "video" ? "🎬 Video" : "🏷 Sponsors"} — ${court.name}`,
    );
  };

  const handleVideoUpload = (court, file) => {
    const fd = new FormData();
    fd.append("active", String(court.break_mode));
    fd.append("display_mode", court.break_display_mode ?? "sponsors");
    fd.append("video", file);
    patchBreakMode(court, fd, "upload");
    showToast(`📤 Uploading video for ${court.name}…`);
  };

  // ── Group by venue ────────────────────────────────────────────────────────
  const byVenue = courts.reduce((acc, c) => {
    const k = c.venue_name || "Venue";
    if (!acc[k]) acc[k] = [];
    acc[k].push(c);
    return acc;
  }, {});

  const activeCount = courts.filter((c) => c.break_mode).length;

  return (
    <div style={P.wrap}>
      {/* Header */}
      <div style={P.header}>
        <div>
          <div style={P.title}>☕ Break Mode</div>
          <div style={P.sub}>
            Activate on any court to replace the scoreboard with sponsors or an
            ad video.
            {activeCount > 0 && (
              <span style={P.badge}>
                {activeCount} court{activeCount > 1 ? "s" : ""} in break
              </span>
            )}
          </div>
        </div>
        {activeCount > 0 && (
          <button
            style={P.allOffBtn}
            onClick={() =>
              courts
                .filter((c) => c.break_mode)
                .forEach((c) => handleToggle(c, false))
            }
          >
            ⏹ End all breaks
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && <div style={P.toast}>{toast}</div>}

      {/* Legend */}
      <div style={P.legend}>
        <span style={P.legendItem}>
          <span
            style={{ ...P.legendDot, background: "rgba(255,200,50,0.6)" }}
          />
          🏷 Sponsors — shows the 3-column sponsor showcase
        </span>
        <span style={P.legendItem}>
          <span
            style={{ ...P.legendDot, background: "rgba(96,165,250,0.6)" }}
          />
          🎬 Video — plays your uploaded MP4 ad fullscreen
        </span>
      </div>

      {/* Courts */}
      {loading ? (
        <div style={P.empty}>Loading courts…</div>
      ) : courts.length === 0 ? (
        <div style={P.empty}>No courts found. Add courts in Venues first.</div>
      ) : (
        Object.entries(byVenue).map(([venueName, venueCourts]) => (
          <div key={venueName} style={P.group}>
            <div style={P.venueLabel}>📍 {venueName}</div>
            {venueCourts.map((c) => (
              <CourtBreakRow
                key={c.id}
                court={c}
                onToggle={handleToggle}
                onModeChange={handleModeChange}
                onVideoUpload={handleVideoUpload}
                busy={busy[c.id] || null}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const P = {
  wrap: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  title: { fontSize: 18, fontWeight: 600, color: "#fff" },
  sub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    marginTop: 4,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    color: "#ff4444",
    background: "rgba(255,68,68,0.12)",
    border: "1px solid rgba(255,68,68,0.25)",
    borderRadius: 20,
    padding: "2px 10px",
  },
  allOffBtn: {
    background: "rgba(255,68,68,0.1)",
    border: "1px solid rgba(255,68,68,0.25)",
    borderRadius: 8,
    color: "#f87171",
    fontSize: 12,
    fontWeight: 700,
    padding: "8px 16px",
    cursor: "pointer",
    flexShrink: 0,
  },
  toast: {
    background: "rgba(200,255,0,0.1)",
    border: "1px solid rgba(200,255,0,0.2)",
    borderRadius: 8,
    padding: "10px 16px",
    fontSize: 13,
    color: "#c8ff00",
    fontWeight: 600,
  },
  legend: { display: "flex", gap: 20, flexWrap: "wrap", padding: "4px 0" },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
  },
  legendDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  group: { display: "flex", flexDirection: "column", gap: 4 },
  venueLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.25)",
    textTransform: "uppercase",
    padding: "8px 0 6px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    marginBottom: 4,
  },
  empty: { color: "rgba(255,255,255,0.2)", fontSize: 13, padding: "8px 0" },
};

const R = {
  row: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.05)",
    flexWrap: "wrap",
    transition: "background 0.2s, border-color 0.2s",
  },
  rowActive: {
    background: "rgba(255,68,68,0.04)",
    borderColor: "rgba(255,68,68,0.15)",
  },
  identity: { flex: 1, minWidth: 140 },
  courtName: { fontSize: 14, fontWeight: 600, color: "#fff" },
  courtSlug: {
    fontSize: 11,
    color: "rgba(200,255,0,0.4)",
    fontFamily: "monospace",
    marginTop: 2,
  },

  // Mode toggle group
  modeGroup: {
    display: "flex",
    gap: 4,
    background: "rgba(255,255,255,0.04)",
    borderRadius: 8,
    padding: 3,
    flexShrink: 0,
  },
  modeBtn: {
    background: "transparent",
    border: "none",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(255,255,255,0.35)",
    cursor: "pointer",
    transition: "all 0.15s",
    whiteSpace: "nowrap",
  },
  modeBtnActive: { background: "rgba(200,255,0,0.12)", color: "#c8ff00" },

  // Video area
  videoArea: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  videoReady: {
    fontSize: 11,
    color: "#60a5fa",
    background: "rgba(96,165,250,0.1)",
    border: "1px solid rgba(96,165,250,0.2)",
    borderRadius: 6,
    padding: "3px 10px",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  videoMissing: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  },
  uploadBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 7,
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: 600,
    padding: "6px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  // ON/OFF toggle
  toggleBtn: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    borderRadius: 9,
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    cursor: "pointer",
    border: "none",
    flexShrink: 0,
    transition: "all 0.2s",
    minWidth: 80,
    justifyContent: "center",
  },
  toggleOn: {
    background: "rgba(255,68,68,0.15)",
    color: "#f87171",
    boxShadow: "0 0 16px rgba(255,68,68,0.2)",
    border: "1px solid rgba(255,68,68,0.3)",
  },
  toggleOff: {
    background: "rgba(200,255,0,0.07)",
    color: "rgba(200,255,0,0.6)",
    border: "1px solid rgba(200,255,0,0.15)",
  },
  dot: (on) => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: on ? "#f87171" : "#c8ff00",
    flexShrink: 0,
    boxShadow: on ? "0 0 5px #f87171" : "0 0 5px #c8ff00",
  }),
};
