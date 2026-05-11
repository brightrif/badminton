// ─── DayFilter.jsx ────────────────────────────────────────────────────────────
// src/components/spectator/DayFilter.jsx

export default function DayFilter({
  startDate,
  endDate,
  selectedDate,
  onChange,
}) {
  if (!startDate || !endDate) return null;
  const days = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const fmt = (d) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };
  return (
    <div style={DF.wrap} className="scroll-row">
      <button
        style={{ ...DF.btn, ...(selectedDate === null ? DF.btnActive : {}) }}
        onClick={() => onChange(null)}
      >
        All days
      </button>
      {days.map((d) => {
        const isToday = d === todayStr;
        const isSelected = d === selectedDate;
        return (
          <button
            key={d}
            style={{
              ...DF.btn,
              ...(isSelected ? DF.btnActive : isToday ? DF.btnToday : {}),
            }}
            onClick={() => onChange(d)}
          >
            {fmt(d)}
            {isToday && <span style={DF.todayDot} />}
          </button>
        );
      })}
    </div>
  );
}

const DF = {
  wrap: { display: "flex", gap: 6, overflowX: "auto", padding: "2px 0 8px" },
  btn: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 13px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    fontSize: 12,
    fontWeight: 500,
    color: "rgba(255,255,255,0.45)",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all .15s",
  },
  btnActive: {
    background: "rgba(200,255,0,0.1)",
    borderColor: "rgba(200,255,0,0.3)",
    color: "#c8ff00",
  },
  btnToday: {
    borderColor: "rgba(200,255,0,0.2)",
    color: "rgba(200,255,0,0.6)",
    fontWeight: 600,
  },
  todayDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: "#c8ff00",
    flexShrink: 0,
  },
};
