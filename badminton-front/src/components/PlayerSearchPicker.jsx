// src/components/PlayerSearchPicker.jsx
//
// Reusable search-as-you-type player picker.
// Used by:
//   - Manage Players panel  (EventRegistration)
//   - Manage Teams panel    (DoublesTeam creation)
//
// Props:
//   onSelect(player)     — called when user clicks a result row
//   excludeIds           — Set of player IDs to hide (already registered / already in team)
//   placeholder          — input placeholder text
//   disabled             — disables the add button
//   actionLabel          — label on the action button (default "+")

import { usePlayerSearch } from "../hooks/usePlayerSearch";

export default function PlayerSearchPicker({
  onSelect,
  excludeIds = new Set(),
  placeholder = "Search players by name…",
  disabled = false,
  actionLabel = "+",
}) {
  const { results, loading, search, setSearch } = usePlayerSearch({
    autoLoad: false, // only fetch when user types
    debounceMs: 250,
    pageSize: 20,
  });

  const visible = results.filter((p) => !excludeIds.has(p.id));

  return (
    <div style={PS.wrap}>
      {/* Search input */}
      <div style={PS.inputWrap}>
        <span style={PS.icon}>🔍</span>
        <input
          style={PS.input}
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        {loading && <span style={PS.spinner}>⟳</span>}
        {search && !loading && (
          <button style={PS.clearBtn} onClick={() => setSearch("")}>
            ✕
          </button>
        )}
      </div>

      {/* Results */}
      {search.length > 0 && (
        <div style={PS.results}>
          {visible.length === 0 && !loading ? (
            <div style={PS.emptyMsg}>
              {results.length > 0
                ? "All matching players are already added."
                : `No players found for "${search}".`}
            </div>
          ) : (
            visible.map((p) => (
              <div key={p.id} style={PS.row}>
                <div style={PS.avatar}>{p.name.charAt(0).toUpperCase()}</div>
                <div style={PS.info}>
                  <div style={PS.playerName}>{p.name}</div>
                  {p.country_name && (
                    <div style={PS.playerCountry}>{p.country_name}</div>
                  )}
                </div>
                <button
                  style={PS.addBtn}
                  onClick={() => {
                    onSelect(p);
                    setSearch("");
                  }}
                  disabled={disabled}
                  title="Add"
                >
                  {actionLabel}
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const PS = {
  wrap: { display: "flex", flexDirection: "column", gap: 0 },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "0 12px",
    gap: 8,
  },
  icon: { fontSize: 13, opacity: 0.45, flexShrink: 0 },
  input: {
    flex: 1,
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: 13,
    padding: "10px 0",
    outline: "none",
  },
  spinner: {
    fontSize: 14,
    color: "rgba(255,255,255,0.3)",
    animation: "spin 1s linear infinite",
  },
  clearBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    cursor: "pointer",
    padding: "2px 4px",
    flexShrink: 0,
  },
  results: {
    background: "rgba(20,20,20,0.98)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderTop: "none",
    borderRadius: "0 0 8px 8px",
    maxHeight: 220,
    overflowY: "auto",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    cursor: "default",
  },
  avatar: {
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
  info: { flex: 1, minWidth: 0 },
  playerName: { fontSize: 13, color: "#fff", fontWeight: 500 },
  playerCountry: { fontSize: 11, color: "rgba(255,255,255,0.35)" },
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
    flexShrink: 0,
  },
  emptyMsg: {
    padding: "12px 14px",
    fontSize: 12,
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
  },
};
