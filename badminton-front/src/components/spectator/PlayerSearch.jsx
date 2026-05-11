// src/components/spectator/PlayerSearch.jsx
//
// Fully controlled input with debounced onChange.
// The parent owns the value state — this component never diverges from it.
//
// Props:
//   value       : string           — controlled value (parent state)
//   onChange    : (string) => void — debounced, fires 300ms after typing stops
//   placeholder : string
//   autoFocus   : boolean

import { useState, useEffect, useRef } from "react";

export default function PlayerSearch({
  value,
  onChange,
  placeholder = "Search player…",
  autoFocus = false,
}) {
  // Local display state — updates immediately on every keystroke
  // so the input feels responsive, while onChange fires after debounce.
  const [localValue, setLocalValue] = useState(value);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  // When parent resets value to "" (e.g. closing journey panel),
  // sync the local display state so the input visually clears.
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const handleChange = (e) => {
    const raw = e.target.value;
    setLocalValue(raw); // immediate visual update

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(raw); // debounced parent update
    }, 300);
  };

  const handleClear = () => {
    clearTimeout(timerRef.current);
    setLocalValue("");
    onChange(""); // immediate clear — no debounce needed
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  return (
    <div style={PS.wrap}>
      <span style={PS.icon}>👤</span>
      <input
        ref={inputRef}
        type="text"
        value={localValue} // ← controlled
        onChange={handleChange}
        placeholder={placeholder}
        style={PS.input}
        aria-label="Search by player name"
      />
      {localValue && (
        <button
          style={PS.clear}
          onClick={handleClear}
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}

const PS = {
  wrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(15,26,0,0.6)",
    border: "1px solid rgba(200,255,0,0.12)",
    borderRadius: 10,
    padding: "0 12px",
    backdropFilter: "blur(8px)",
  },
  icon: { fontSize: 13, flexShrink: 0, color: "rgba(200,255,0,0.3)" },
  input: {
    flex: 1,
    border: "none",
    outline: "none",
    fontSize: 13,
    color: "#fff",
    padding: "11px 0",
    background: "transparent",
  },
  clear: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    color: "rgba(200,255,0,0.3)",
    padding: "4px",
    lineHeight: 1,
    flexShrink: 0,
  },
};
