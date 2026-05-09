// src/pages/director/Sponsors.jsx
//
// Sponsor management — shows tier badge (Title / Gold / Standard)
// based on priority so the director knows exactly what each sponsor gets.

import { useState } from "react";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { useAuth } from "../../context/AuthContext";
import Modal, {
  FormField,
  Input,
  Select,
  SubmitBtn,
} from "../../components/Modal";

// ─── Tier helpers — must match SponsorDisplay.jsx ────────────────────────────
function getTier(priority = 0) {
  if (priority >= 80) return "title";
  if (priority >= 40) return "gold";
  return "standard";
}

const TIER_META = {
  title: {
    label: "TITLE",
    color: "#e8c800",
    bg: "rgba(232,200,0,0.12)",
    border: "rgba(232,200,0,0.3)",
    hint: "Large logo + name · Always visible · 'PRESENTED BY' in match winner overlay",
  },
  gold: {
    label: "GOLD",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
    hint: "Medium logo + name · Shown alongside standard sponsors",
  },
  standard: {
    label: "STANDARD",
    color: "rgba(255,255,255,0.4)",
    bg: "rgba(255,255,255,0.05)",
    border: "rgba(255,255,255,0.1)",
    hint: "Compact logo only · Shown in row with other standard sponsors",
  },
};

function TierBadge({ priority }) {
  const tier = getTier(priority);
  const meta = TIER_META[tier];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 2,
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: 6,
        padding: "2px 8px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {meta.label}
    </span>
  );
}

// ─── Sponsor card ─────────────────────────────────────────────────────────────
function SponsorCard({ s, onEdit, onDelete }) {
  const tier = getTier(s.priority);
  const meta = TIER_META[tier];
  return (
    <div style={{ ...SC.card, borderColor: meta.border }}>
      {/* Tier stripe at top */}
      <div
        style={{
          height: 3,
          background: meta.color,
          borderRadius: "2px 2px 0 0",
          opacity: 0.7,
        }}
      />

      <div style={SC.body}>
        <div style={SC.logoWrap}>
          {s.logo_url ? (
            <img src={s.logo_url} alt={s.name} style={SC.logo} />
          ) : (
            <div style={SC.logoPlaceholder}>{s.name[0]}</div>
          )}
        </div>
        <div style={SC.info}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div style={SC.name}>{s.name}</div>
            <TierBadge priority={s.priority} />
          </div>
          <div style={SC.meta}>{s.tournament_name ?? "Global"}</div>
          <div style={SC.tierHint}>{meta.hint}</div>
          <div style={SC.priority}>
            Priority:{" "}
            <strong style={{ color: meta.color }}>{s.priority}</strong>
          </div>
        </div>
        <div style={SC.actions}>
          <button style={SC.editBtn} onClick={() => onEdit(s)}>
            Edit
          </button>
          <button style={SC.delBtn} onClick={() => onDelete(s)}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

const SC = {
  card: {
    background: "#111",
    border: "1px solid",
    borderRadius: 12,
    overflow: "hidden",
  },
  body: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "16px 18px",
  },
  logoWrap: { flexShrink: 0 },
  logo: {
    width: 56,
    height: 56,
    objectFit: "contain",
    borderRadius: 8,
    background: "#fff",
    padding: 4,
  },
  logoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    background: "rgba(200,255,0,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#c8ff00",
    fontSize: 22,
    fontWeight: 700,
  },
  info: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, color: "#fff", fontWeight: 600 },
  meta: { fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 4 },
  tierHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.2)",
    lineHeight: 1.5,
    marginBottom: 4,
  },
  priority: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  actions: { display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "none",
    borderRadius: 6,
    padding: "5px 12px",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    cursor: "pointer",
  },
  delBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,100,100,0.4)",
    fontSize: 14,
    cursor: "pointer",
    padding: "4px",
  },
};

// ─── Tier guide panel ─────────────────────────────────────────────────────────
function TierGuide() {
  return (
    <div style={TG.wrap}>
      <div style={TG.title}>📺 How sponsor tiers appear on the big screen</div>
      <div style={TG.grid}>
        {Object.entries(TIER_META).map(([tier, meta]) => (
          <div key={tier} style={{ ...TG.card, borderColor: meta.border }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: meta.color,
                }}
              >
                {meta.label}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
                {tier === "title"
                  ? "priority 80–100"
                  : tier === "gold"
                    ? "priority 40–79"
                    : "priority 0–39"}
              </span>
            </div>
            <div style={TG.hint}>{meta.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TG = {
  wrap: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "16px 20px",
  },
  title: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    marginBottom: 12,
    fontWeight: 600,
  },
  grid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid",
    borderRadius: 8,
    padding: "10px 14px",
  },
  hint: { fontSize: 11, color: "rgba(255,255,255,0.25)", lineHeight: 1.6 },
};

// ─── Sponsor form ─────────────────────────────────────────────────────────────
function SponsorForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: tournaments } = useApi("/api/tournaments/");
  const [name, setName] = useState(initial?.name || "");
  const [tournament, setTournament] = useState(initial?.tournament || "");
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const tier = getTier(Number(priority));
  const meta = TIER_META[tier];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("priority", priority);
      if (tournament) fd.append("tournament", tournament);
      if (logo) fd.append("logo", logo);
      const res = await authFetch(
        initial ? `/api/sponsors/${initial.id}/` : "/api/sponsors/",
        { method: initial ? "PATCH" : "POST", body: fd, headers: {} },
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

  const tournOpts = Array.isArray(tournaments) ? tournaments : [];

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {error && <div style={S.errBox}>{error}</div>}

      <FormField label="Sponsor name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Yonex"
          required
        />
      </FormField>

      <FormField label="Tournament" hint="Leave blank for a global sponsor">
        <Select
          value={tournament}
          onChange={(e) => setTournament(e.target.value)}
        >
          <option value="">— Global sponsor —</option>
          {tournOpts.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </FormField>

      {/* Priority slider with live tier preview */}
      <FormField
        label="Display priority"
        hint="Sets the tier and order in the carousel"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="range"
              min="0"
              max="100"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              style={{ flex: 1, accentColor: meta.color }}
            />
            <span
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontSize: 20,
                fontWeight: 700,
                color: meta.color,
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {priority}
            </span>
          </div>
          {/* Live tier badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: meta.bg,
              border: `1px solid ${meta.border}`,
              borderRadius: 8,
            }}
          >
            <TierBadge priority={priority} />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {meta.hint}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "rgba(255,255,255,0.2)",
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <span>0 Standard</span>
            <span>40 Gold</span>
            <span>80 Title</span>
          </div>
        </div>
      </FormField>

      <FormField
        label="Logo image"
        hint="PNG or SVG on transparent background · min 400×200px recommended"
      >
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setLogo(e.target.files[0])}
          style={S.fileInput}
        />
        {initial?.logo_url && !logo && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 8,
            }}
          >
            <img
              src={initial.logo_url}
              alt="Current"
              style={{
                height: 40,
                borderRadius: 6,
                background: "#fff",
                padding: 4,
              }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              Current logo
            </span>
          </div>
        )}
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
          {initial ? "Save changes" : "Add sponsor"}
        </SubmitBtn>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Sponsors() {
  const { authFetch } = useAuth();
  const { data: sponsors, loading, refresh } = useApi("/api/sponsors/");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("");

  const handleDelete = async (s) => {
    if (!confirm(`Delete sponsor "${s.name}"?`)) return;
    await authFetch(`/api/sponsors/${s.id}/`, { method: "DELETE" });
    refresh();
  };

  const allSponsors = Array.isArray(sponsors) ? sponsors : [];

  const filtered = allSponsors
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.tournament_name || "").toLowerCase().includes(search.toLowerCase()),
    )
    .filter((s) => (filterTier ? getTier(s.priority) === filterTier : true))
    .sort((a, b) => b.priority - a.priority);

  // Counts per tier
  const counts = { title: 0, gold: 0, standard: 0 };
  allSponsors.forEach((s) => counts[getTier(s.priority)]++);

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.topBar}>
        <div>
          <div style={S.title}>Sponsors</div>
          <div style={S.sub}>
            {allSponsors.length} total &nbsp;·&nbsp;
            <span style={{ color: "#e8c800" }}>{counts.title} title</span>{" "}
            &nbsp;·&nbsp;
            <span style={{ color: "#f59e0b" }}>{counts.gold} gold</span>{" "}
            &nbsp;·&nbsp;
            <span style={{ color: "rgba(255,255,255,0.3)" }}>
              {counts.standard} standard
            </span>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            style={S.search}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            style={S.tierFilter}
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
          >
            <option value="">All tiers</option>
            <option value="title">Title only</option>
            <option value="gold">Gold only</option>
            <option value="standard">Standard only</option>
          </select>
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>
            + Add sponsor
          </button>
        </div>
      </div>

      <TierGuide />

      {loading ? (
        <div style={S.loading}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={S.loading}>No sponsors found.</div>
      ) : (
        <div style={S.grid}>
          {filtered.map((s) => (
            <SponsorCard
              key={s.id}
              s={s}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {(showCreate || editing) && (
        <Modal
          title={editing ? "Edit sponsor" : "Add sponsor"}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
        >
          <SponsorForm
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

const CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600;700;800&display=swap');`;

const S = {
  page: { display: "flex", flexDirection: "column", gap: 24 },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
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
    width: 180,
  },
  tierFilter: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    cursor: "pointer",
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
  loading: { color: "rgba(255,255,255,0.3)", fontSize: 14 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: 14,
  },
  errBox: {
    background: "rgba(255,60,60,0.1)",
    border: "1px solid rgba(255,60,60,0.3)",
    color: "#ff6b6b",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
  },
  fileInput: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    width: "100%",
    color: "rgba(255,255,255,0.5)",
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
};
