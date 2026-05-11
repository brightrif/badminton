// src/components/spectator/SpectatorLink.jsx
// Drop-in component for the director's tournament list cards.
// Matches the #0a0a0a dark theme with #c8ff00 accent.
import { useState } from "react";

const ORIGIN = window.location.origin;

export default function SpectatorLink({
  tournamentId,
  tournamentName,
  compact = false,
}) {
  const [copied, setCopied] = useState(false);
  const url = `${ORIGIN}/spectator/tournament/${tournamentId}`;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      })
      .catch(() => window.prompt("Copy spectator URL:", url));
  };
  const handleOpen = (e) => {
    e.stopPropagation();
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (compact) {
    return (
      <button
        style={{ ...SL.icon, ...(copied ? SL.iconCopied : {}) }}
        onClick={handleCopy}
        title={copied ? "Copied!" : `Copy spectator URL for ${tournamentName}`}
      >
        {copied ? "✓" : "🔗"}
      </button>
    );
  }

  return (
    <div style={SL.wrap} onClick={(e) => e.stopPropagation()}>
      <button
        style={{ ...SL.copy, ...(copied ? SL.copyCopied : {}) }}
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <span>✓</span> Copied!
          </>
        ) : (
          <>
            <span>🔗</span> Spectator view
          </>
        )}
      </button>
      <button
        style={SL.open}
        onClick={handleOpen}
        title="Open spectator page"
        aria-label="Open in new tab"
      >
        ↗
      </button>
    </div>
  );
}

const SL = {
  wrap: { display: "flex", alignItems: "center", gap: 4 },
  copy: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(200,255,0,0.08)",
    border: "1px solid rgba(200,255,0,0.18)",
    color: "#c8ff00",
    borderRadius: 7,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .15s",
    whiteSpace: "nowrap",
  },
  copyCopied: {
    background: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.25)",
    color: "#4ade80",
  },
  open: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.35)",
    borderRadius: 7,
    padding: "5px 9px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .15s",
  },
  icon: {
    background: "rgba(200,255,0,0.08)",
    border: "1px solid rgba(200,255,0,0.18)",
    color: "#c8ff00",
    borderRadius: 6,
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 13,
    transition: "all .15s",
  },
  iconCopied: {
    background: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.25)",
    color: "#4ade80",
  },
};
