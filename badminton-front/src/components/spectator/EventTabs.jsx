// src/components/spectator/EventTabs.jsx

export default function EventTabs({
  events = [],
  selectedEventId,
  onChange,
  onBracketClick,
  liveCountMap = {},
}) {
  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const isKnockout = selectedEvent?.format === "KNOCKOUT";
  const totalLive = Object.values(liveCountMap).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div style={ET.row} className="scroll-row">
        {/* All Matches */}
        <button
          style={{
            ...ET.tab,
            ...(selectedEventId === null ? ET.tabActive : {}),
          }}
          onClick={() => onChange(null)}
        >
          All Matches
          {totalLive > 0 && (
            <span
              style={{
                ...ET.badge,
                background:
                  selectedEventId === null
                    ? "rgba(200,255,0,0.2)"
                    : "rgba(200,255,0,0.08)",
                color: "#c8ff00",
              }}
            >
              {totalLive}
            </span>
          )}
        </button>

        {events.map((ev) => {
          const isActive = ev.id === selectedEventId;
          const live = liveCountMap[ev.id] || 0;
          return (
            <button
              key={ev.id}
              style={{ ...ET.tab, ...(isActive ? ET.tabActive : {}) }}
              onClick={() => onChange(ev.id)}
            >
              {ev.name}
              {live > 0 && (
                <span
                  style={{
                    ...ET.badge,
                    background: isActive
                      ? "rgba(200,255,0,0.2)"
                      : "rgba(200,255,0,0.08)",
                    color: "#c8ff00",
                  }}
                >
                  {live}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bracket link for KNOCKOUT events */}
      {isKnockout && selectedEventId && (
        <div style={ET.bracketBar}>
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={ET.bracketLabel}>{selectedEvent.name}</span>
          <span style={ET.bracketDot}>·</span>
          <span style={ET.bracketFmt}>Knockout bracket</span>
          <button
            style={ET.bracketBtn}
            onClick={() => onBracketClick?.(selectedEventId)}
          >
            View bracket tree →
          </button>
        </div>
      )}
    </div>
  );
}

const ET = {
  row: { display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 4px" },
  tab: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    fontSize: 13,
    fontWeight: 500,
    color: "rgba(255,255,255,0.4)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all .15s",
  },
  tabActive: {
    background: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.15)",
    color: "#fff",
  },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: 10,
    lineHeight: 1.6,
  },
  bracketBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    padding: "10px 14px",
    background: "rgba(200,255,0,0.05)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 10,
    flexWrap: "wrap",
  },
  bracketLabel: { fontSize: 13, fontWeight: 600, color: "#c8ff00" },
  bracketDot: { fontSize: 12, color: "rgba(200,255,0,0.35)" },
  bracketFmt: { fontSize: 12, color: "rgba(200,255,0,0.5)", flex: 1 },
  bracketBtn: {
    padding: "5px 13px",
    borderRadius: 8,
    border: "1px solid rgba(200,255,0,0.25)",
    background: "rgba(200,255,0,0.08)",
    color: "#c8ff00",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
};
