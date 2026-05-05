// src/pages/director/Players.jsx
//
// Changes from previous version:
//   - No longer uses useDirectorApi (which loaded all players at once)
//   - Uses usePlayerSearch hook: first 50 on mount, Load More appends next page
//   - Search box filters via API (debounced 300ms), resets to page 1
//   - Shows "X of Y players" counter

import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { usePlayerSearch } from "../../hooks/usePlayerSearch";
import Modal, {
  FormField,
  Input,
  Select,
  SubmitBtn,
} from "../../components/Modal";

// ─── Player card ──────────────────────────────────────────────────────────────

function PlayerCard({ p, onEdit, onDelete }) {
  const photo =
    p.photo_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1a2d00&color=c8ff00&size=80`;
  return (
    <div style={S.card}>
      <div style={S.avatar}>
        <img
          src={photo}
          alt={p.name}
          style={S.photo}
          onError={(e) => {
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1a2d00&color=c8ff00&size=80`;
          }}
        />
      </div>
      <div style={S.info}>
        <div style={S.name}>{p.name}</div>
        <div style={S.country}>
          {p.country_code && <span style={S.code}>{p.country_code}</span>}
          {p.country_name || ""}
        </div>
      </div>
      <div style={S.actions}>
        <button style={S.editBtn} onClick={() => onEdit(p)}>
          Edit
        </button>
        <button style={S.delBtn} onClick={() => onDelete(p)}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Player form ──────────────────────────────────────────────────────────────

function PlayerForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: countries } = useApi("/api/countries/");
  const [name, setName] = useState(initial?.name || "");
  const [country, setCountry] = useState(initial?.country || "");
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("country", country);
      if (photo) fd.append("photo", photo);
      const res = await authFetch(
        initial ? `/api/players/${initial.id}/` : "/api/players/",
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

  const countryOpts = Array.isArray(countries) ? countries : [];

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: 18 }}
    >
      {error && <div style={S.errBox}>{error}</div>}
      <FormField label="Full name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Viktor Axelsen"
          required
        />
      </FormField>
      <FormField label="Country">
        <Select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          required
        >
          <option value="">— Select country —</option>
          {countryOpts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code})
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Player photo" hint="Optional — JPEG or PNG">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setPhoto(e.target.files[0])}
          style={{ ...S.fileInput, color: "rgba(255,255,255,0.5)" }}
        />
        {initial?.photo_url && !photo && (
          <div style={S.currentPhoto}>
            <img
              src={initial.photo_url}
              alt="Current"
              style={{ height: 40, borderRadius: 6 }}
            />
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
              Current photo
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
          {initial ? "Save changes" : "Add player"}
        </SubmitBtn>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Players() {
  const { authFetch } = useAuth();

  const {
    results: players,
    loading,
    search,
    setSearch,
    loadMore,
    hasMore,
    total,
  } = usePlayerSearch({ pageSize: 50, autoLoad: true });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  const handleDelete = async (p) => {
    if (!confirm(`Delete player "${p.name}"?`)) return;
    await authFetch(`/api/players/${p.id}/`, { method: "DELETE" });
    // Re-trigger search to refresh list
    setSearch((s) => s);
  };

  const handleSaved = () => {
    setShowCreate(false);
    setEditing(null);
    setSearch((s) => s); // refresh current search
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={S.topBar}>
        <div>
          <div style={S.title}>Players</div>
          <div style={S.sub}>
            {search
              ? `${players.length} result${players.length !== 1 ? "s" : ""} for "${search}"`
              : `${players.length} of ${total} player${total !== 1 ? "s" : ""} loaded`}
          </div>
        </div>
        <button style={S.createBtn} onClick={() => setShowCreate(true)}>
          + Add player
        </button>
      </div>

      {/* Search bar */}
      <div style={S.searchRow}>
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>🔍</span>
          <input
            style={S.searchInput}
            placeholder="Search by name or country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={S.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Player grid */}
      {loading && players.length === 0 ? (
        <div style={S.loading}>Loading players…</div>
      ) : players.length === 0 ? (
        <div style={S.empty}>
          {search
            ? `No players found matching "${search}".`
            : "No players yet. Add your first player."}
        </div>
      ) : (
        <>
          <div style={S.grid}>
            {players.map((p) => (
              <PlayerCard
                key={p.id}
                p={p}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div style={S.loadMoreRow}>
              <button
                style={S.loadMoreBtn}
                onClick={loadMore}
                disabled={loading}
              >
                {loading
                  ? "Loading…"
                  : `Load more (showing ${players.length} of ${total})`}
              </button>
            </div>
          )}

          {!hasMore && players.length > 0 && (
            <div style={S.allLoaded}>All {total} players loaded</div>
          )}
        </>
      )}

      {/* Modals */}
      {(showCreate || editing) && (
        <Modal
          title={editing ? "Edit player" : "Add player"}
          onClose={() => {
            setShowCreate(false);
            setEditing(null);
          }}
        >
          <PlayerForm
            initial={editing}
            onSave={handleSaved}
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
  input:focus { outline: none; border-color: rgba(200,255,0,0.4) !important; }
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
    flexShrink: 0,
  },

  // Search
  searchRow: { display: "flex", gap: 12 },
  searchWrap: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "0 14px",
    gap: 8,
    flex: 1,
    maxWidth: 400,
  },
  searchIcon: { fontSize: 14, opacity: 0.5 },
  searchInput: {
    flex: 1,
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 13,
    padding: "11px 0",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    cursor: "pointer",
    padding: "4px",
  },

  // Grid
  loading: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    textAlign: "center",
    padding: "40px 0",
  },
  empty: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    textAlign: "center",
    padding: "40px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },

  // Card
  card: {
    background: "#111",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
  },
  avatar: { flexShrink: 0 },
  photo: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    objectFit: "cover",
    background: "#1a2d00",
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 14,
    color: "#fff",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  country: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  code: {
    background: "rgba(200,255,0,0.1)",
    color: "#c8ff00",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1px",
  },
  actions: { display: "flex", gap: 6, flexShrink: 0 },
  editBtn: {
    background: "rgba(255,255,255,0.06)",
    border: "none",
    borderRadius: 6,
    padding: "5px 10px",
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

  // Load more
  loadMoreRow: { display: "flex", justifyContent: "center", paddingTop: 8 },
  loadMoreBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10,
    padding: "11px 28px",
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    cursor: "pointer",
  },
  allLoaded: {
    textAlign: "center",
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
    paddingTop: 8,
  },

  // Form
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
  },
  currentPhoto: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
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
