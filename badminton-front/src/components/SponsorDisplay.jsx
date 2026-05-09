// src/components/SponsorDisplay.jsx
//
// Tier-aware sponsor display for the big screen.
// Tiers are derived from the sponsor's `priority` field:
//
//   priority 80–100  →  TITLE   — large logo + name, gold accent
//   priority 40–79   →  GOLD    — medium logo + name, subtle gold
//   priority  0–39   →  STANDARD — compact logo only
//
// The parent (App.jsx / CourtScreen.jsx) passes a `tier` prop directly
// so this component stays pure/presentational.

import React from "react";

export function getTier(priority = 0) {
  if (priority >= 80) return "title";
  if (priority >= 40) return "gold";
  return "standard";
}

// ─── Title sponsor — full treatment ──────────────────────────────────────────
function TitleSponsor({ sponsor }) {
  const logo = sponsor.logo_url || sponsor.logo;
  return (
    <div style={T.wrap}>
      <div style={T.label}>TITLE SPONSOR</div>
      <div style={T.card}>
        {logo ? (
          <img
            src={logo}
            alt={sponsor.name}
            style={T.logo}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div style={{ ...T.fallback, display: logo ? "none" : "flex" }}>
          {sponsor.name}
        </div>
      </div>
      <div style={T.name}>{sponsor.name}</div>
    </div>
  );
}

const T = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: "clamp(7px,0.7vw,9px)",
    fontWeight: 800,
    letterSpacing: 3,
    color: "rgba(232,200,0,0.5)",
    fontFamily: "'DM Sans',sans-serif",
  },
  card: {
    background: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    padding: "10px 22px",
    height: 72,
    minWidth: 160,
    maxWidth: 240,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 1px rgba(232,200,0,0.4), 0 0 24px rgba(232,200,0,0.15)",
    overflow: "hidden",
  },
  logo: {
    maxHeight: 52,
    maxWidth: 200,
    objectFit: "contain",
    display: "block",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 15,
    fontWeight: 800,
    color: "#111",
    letterSpacing: 1,
  },
  name: {
    fontSize: "clamp(9px,0.8vw,11px)",
    fontWeight: 700,
    letterSpacing: 2,
    color: "rgba(232,200,0,0.6)",
    fontFamily: "'DM Sans',sans-serif",
    textTransform: "uppercase",
  },
};

// ─── Gold sponsor ─────────────────────────────────────────────────────────────
function GoldSponsor({ sponsor }) {
  const logo = sponsor.logo_url || sponsor.logo;
  return (
    <div style={G.wrap}>
      <div style={G.card}>
        {logo ? (
          <img
            src={logo}
            alt={sponsor.name}
            style={G.logo}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.nextSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div style={{ ...G.fallback, display: logo ? "none" : "flex" }}>
          {sponsor.name}
        </div>
      </div>
      <div style={G.name}>{sponsor.name}</div>
    </div>
  );
}

const G = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
  },
  card: {
    background: "rgba(255,255,255,0.93)",
    borderRadius: 10,
    padding: "8px 18px",
    height: 58,
    minWidth: 120,
    maxWidth: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  logo: {
    maxHeight: 40,
    maxWidth: 150,
    objectFit: "contain",
    display: "block",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    fontWeight: 700,
    color: "#111",
  },
  name: {
    fontSize: "clamp(8px,0.7vw,10px)",
    fontWeight: 600,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.3)",
    fontFamily: "'DM Sans',sans-serif",
    textTransform: "uppercase",
  },
};

// ─── Standard sponsor ─────────────────────────────────────────────────────────
function StandardSponsor({ sponsor }) {
  const logo = sponsor.logo_url || sponsor.logo;
  return (
    <div style={ST.card}>
      {logo ? (
        <img
          src={logo}
          alt={sponsor.name}
          style={ST.logo}
          onError={(e) => {
            e.target.style.display = "none";
            e.target.nextSibling.style.display = "flex";
          }}
        />
      ) : null}
      <div style={{ ...ST.fallback, display: logo ? "none" : "flex" }}>
        {sponsor.name}
      </div>
    </div>
  );
}

const ST = {
  card: {
    background: "rgba(255,255,255,0.88)",
    borderRadius: 8,
    padding: "6px 14px",
    height: 46,
    minWidth: 90,
    maxWidth: 140,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: {
    maxHeight: 32,
    maxWidth: 110,
    objectFit: "contain",
    display: "block",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 11,
    fontWeight: 700,
    color: "#111",
  },
};

// ─── Default export — picks the right component by tier ──────────────────────
export default function SponsorDisplay({ sponsor, tier }) {
  if (!sponsor) return null;
  const t = tier || getTier(sponsor.priority ?? 0);
  if (t === "title") return <TitleSponsor sponsor={sponsor} />;
  if (t === "gold") return <GoldSponsor sponsor={sponsor} />;
  return <StandardSponsor sponsor={sponsor} />;
}
