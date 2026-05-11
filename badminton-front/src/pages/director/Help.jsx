// src/pages/director/Help.jsx
//
// Help & Links page in the director portal.
// Shows every shareable URL in the system, grouped by audience.
// Each URL has a copy button and an open-in-new-tab button.
// Court screen URLs are fetched live from the API so slugs are always current.

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";

const ORIGIN = window.location.origin;
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ url, compact = false }) {
  const [copied, setCopied] = useState(false);
  const handle = (e) => {
    e.stopPropagation();
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => window.prompt("Copy this URL:", url));
  };
  return (
    <button
      style={{ ...H.copyBtn, ...(copied ? H.copyBtnDone : {}) }}
      onClick={handle}
      title="Copy URL"
    >
      {copied ? "✓ Copied" : compact ? "Copy" : "📋 Copy"}
    </button>
  );
}

// ─── Open button ──────────────────────────────────────────────────────────────

function OpenBtn({ url }) {
  return (
    <button
      style={H.openBtn}
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
      title="Open in new tab"
    >
      ↗
    </button>
  );
}

// ─── URL row ──────────────────────────────────────────────────────────────────

function UrlRow({ icon, label, url, description, tag, tagColor }) {
  const display = url.replace(ORIGIN, "");
  return (
    <div style={H.urlRow}>
      <div style={H.urlLeft}>
        <span style={H.urlIcon}>{icon}</span>
        <div style={H.urlInfo}>
          <div style={H.urlLabel}>
            {label}
            {tag && (
              <span
                style={{
                  ...H.tag,
                  background: tagColor || "rgba(200,255,0,0.1)",
                  color: tagColor ? "#fff" : "#c8ff00",
                }}
              >
                {tag}
              </span>
            )}
          </div>
          {description && <div style={H.urlDesc}>{description}</div>}
          <div style={H.urlPath}>{display}</div>
        </div>
      </div>
      <div style={H.urlActions}>
        <CopyBtn url={url} compact />
        <OpenBtn url={url} />
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ icon, title, subtitle, accent, children }) {
  return (
    <div
      style={{ ...H.section, borderColor: accent || "rgba(200,255,0,0.08)" }}
    >
      <div style={H.sectionHead}>
        <span style={H.sectionIcon}>{icon}</span>
        <div>
          <div style={H.sectionTitle}>{title}</div>
          {subtitle && <div style={H.sectionSub}>{subtitle}</div>}
        </div>
      </div>
      <div style={H.sectionBody}>{children}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Help() {
  const { authFetch } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [courts, setCourts] = useState([]);
  const [loadingT, setLoadingT] = useState(true);
  const [loadingC, setLoadingC] = useState(true);

  // Fetch tournaments for spectator links
  useEffect(() => {
    authFetch("/api/tournaments/?ordering=-start_date")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : (d.results ?? []);
        setTournaments(arr.slice(0, 10)); // show latest 10
      })
      .catch(() => {})
      .finally(() => setLoadingT(false));
  }, [authFetch]);

  // Fetch all courts for screen URLs
  useEffect(() => {
    authFetch("/api/courts/?ordering=venue__name,name")
      .then((r) => r.json())
      .then((d) => {
        const arr = Array.isArray(d) ? d : (d.results ?? []);
        setCourts(arr.filter((c) => c.slug));
      })
      .catch(() => {})
      .finally(() => setLoadingC(false));
  }, [authFetch]);

  return (
    <div style={H.page}>
      <style>{CSS}</style>

      {/* Page header */}
      <div style={H.header}>
        <div>
          <div style={H.title}>Help &amp; Links</div>
          <div style={H.sub}>All shareable URLs for your tournament system</div>
        </div>
        <div style={H.hostBadge}>
          <span style={H.hostLabel}>Running on</span>
          <span style={H.hostUrl}>{ORIGIN}</span>
        </div>
      </div>

      {/* ── 1. Spectator Portal ─────────────────────────────────────────── */}
      <Section
        icon="👥"
        title="Spectator Portal"
        subtitle="Share with players, parents, and spectators — no login required"
        accent="rgba(200,255,0,0.15)"
      >
        <UrlRow
          icon="🏸"
          label="All tournaments"
          url={`${ORIGIN}/spectator`}
          description="Landing page listing all active and recent tournaments"
          tag="Public"
        />

        {loadingT ? (
          <div style={H.loading}>Loading tournaments…</div>
        ) : tournaments.length === 0 ? (
          <div style={H.empty}>
            No tournaments yet. Create one to generate a spectator link.
          </div>
        ) : (
          tournaments.map((t) => (
            <UrlRow
              key={t.id}
              icon="🏆"
              label={t.name}
              url={`${ORIGIN}/spectator/tournament/${t.id}`}
              description="Schedule, day filter, player search, live scores, bracket links"
              tag="Public"
            />
          ))
        )}
      </Section>

      {/* ── 2. Court Scoreboards ────────────────────────────────────────── */}
      <Section
        icon="🖥️"
        title="Court Scoreboards"
        subtitle="Open each URL on that court's TV or projector — auto-displays the live match"
        accent="rgba(100,180,255,0.12)"
      >
        {loadingC ? (
          <div style={H.loading}>Loading courts…</div>
        ) : courts.length === 0 ? (
          <div style={H.empty}>
            No courts with slugs found. Go to <strong>Venues</strong> → expand a
            venue → set a slug for each court.
          </div>
        ) : (
          courts.map((c) => (
            <UrlRow
              key={c.id}
              icon="📺"
              label={c.name}
              url={`${ORIGIN}/screen/court/${c.slug}`}
              description={`Venue: ${c.venue_name || "—"} · Slug: ${c.slug}`}
              tag="Display"
              tagColor="rgba(100,180,255,0.5)"
            />
          ))
        )}

        {/* Main big screen fallback */}
        <UrlRow
          icon="📡"
          label="Main scoreboard (auto-selects first live match)"
          url={`${ORIGIN}/`}
          description="Fallback big-screen view — picks the first live match automatically"
          tag="Display"
          tagColor="rgba(100,180,255,0.5)"
        />
      </Section>

      {/* ── 3. Umpire Access ────────────────────────────────────────────── */}
      <Section
        icon="🏅"
        title="Umpire Access"
        subtitle="Share with umpires before the tournament — they use this to enter PIN and score"
        accent="rgba(255,180,50,0.12)"
      >
        <UrlRow
          icon="🔢"
          label="Umpire score entry (PIN)"
          url={`${ORIGIN}/umpire/score-entry`}
          description="Umpire selects their match and enters a 4-digit PIN to start scoring"
          tag="Umpire"
          tagColor="rgba(255,180,50,0.5)"
        />
        <UrlRow
          icon="🔑"
          label="Umpire login (password)"
          url={`${ORIGIN}/umpire/login`}
          description="Full umpire account login — gives access to all assigned matches"
          tag="Umpire"
          tagColor="rgba(255,180,50,0.5)"
        />
        <UrlRow
          icon="📋"
          label="Umpire dashboard"
          url={`${ORIGIN}/umpire/dashboard`}
          description="After login — shows all assigned matches with scoring buttons"
          tag="Umpire"
          tagColor="rgba(255,180,50,0.5)"
        />
      </Section>

      {/* ── 4. Director Portal ──────────────────────────────────────────── */}
      <Section
        icon="⚙️"
        title="Director Portal"
        subtitle="For tournament directors only — requires login"
        accent="rgba(255,100,100,0.1)"
      >
        <UrlRow
          icon="🔐"
          label="Director login"
          url={`${ORIGIN}/director/login`}
          description="Sign in to manage tournaments, matches, players, and venues"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="⊞"
          label="Dashboard"
          url={`${ORIGIN}/director/dashboard`}
          description="Overview — live matches, today's schedule, stats"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="🏆"
          label="Tournaments"
          url={`${ORIGIN}/director/tournaments`}
          description="Create and manage tournaments"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="🏸"
          label="Matches"
          url={`${ORIGIN}/director/matches`}
          description="Schedule matches, assign courts, umpires, and PINs"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="👤"
          label="Players"
          url={`${ORIGIN}/director/players`}
          description="Add and manage player profiles"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="📋"
          label="Events"
          url={`${ORIGIN}/director/events`}
          description="Configure tournament events (Men's Singles, Women's Doubles, etc.)"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="★"
          label="Sponsors"
          url={`${ORIGIN}/director/sponsors`}
          description="Add sponsor logos shown on the scoreboard"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
        <UrlRow
          icon="📍"
          label="Venues"
          url={`${ORIGIN}/director/venues`}
          description="Manage venues and court screen URLs"
          tag="Director"
          tagColor="rgba(255,100,100,0.45)"
        />
      </Section>

      {/* ── 5. Quick reference card ─────────────────────────────────────── */}
      <Section
        icon="📌"
        title="Quick Reference"
        subtitle="Who gets which URL"
        accent="rgba(200,255,0,0.06)"
      >
        <div style={H.refGrid}>
          {[
            {
              audience: "Spectators / Parents",
              icon: "👥",
              urls: [`${ORIGIN}/spectator`],
              note: "Share before and during the tournament",
              color: "#c8ff00",
            },
            {
              audience: "Umpires",
              icon: "🏅",
              urls: [`${ORIGIN}/umpire/score-entry`],
              note: "Share before the tournament starts",
              color: "#fbbf24",
            },
            {
              audience: "Court TVs / Projectors",
              icon: "🖥️",
              urls: courts
                .slice(0, 3)
                .map((c) => `${ORIGIN}/screen/court/${c.slug}`),
              note: "Open on each court's display device and leave running",
              color: "#60a5fa",
            },
            {
              audience: "Directors",
              icon: "⚙️",
              urls: [`${ORIGIN}/director/login`],
              note: "Keep this private — requires username and password",
              color: "#f87171",
            },
          ].map(({ audience, icon, urls, note, color }) => (
            <div
              key={audience}
              style={{ ...H.refCard, borderColor: color + "33" }}
            >
              <div style={{ ...H.refCardAccent, background: color }} />
              <div style={H.refAudience}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <span style={H.refAudienceLabel}>{audience}</span>
              </div>
              <div style={H.refUrls}>
                {urls.map((url) => (
                  <div key={url} style={H.refUrlRow}>
                    <span style={H.refUrlText}>{url.replace(ORIGIN, "")}</span>
                    <CopyBtn url={url} compact />
                  </div>
                ))}
                {urls.length === 0 && (
                  <span
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}
                  >
                    No courts configured yet
                  </span>
                )}
              </div>
              <div style={H.refNote}>{note}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────

const H = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    animation: "fadeIn .2s ease",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 4,
  },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 28,
    color: "#fff",
    letterSpacing: "-0.5px",
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
  },
  hostBadge: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    background: "rgba(200,255,0,0.05)",
    border: "1px solid rgba(200,255,0,0.1)",
    borderRadius: 10,
    padding: "8px 14px",
  },
  hostLabel: {
    fontSize: 10,
    color: "rgba(200,255,0,0.4)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  hostUrl: {
    fontSize: 13,
    fontWeight: 600,
    color: "#c8ff00",
    fontFamily: "monospace",
  },

  // Section
  section: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 16,
    overflow: "hidden",
  },
  sectionHead: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "18px 20px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  sectionIcon: {
    fontSize: 20,
    lineHeight: 1,
    marginTop: 1,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.35)",
  },
  sectionBody: {
    display: "flex",
    flexDirection: "column",
  },

  // URL row
  urlRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "13px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background .1s",
  },
  urlLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  urlIcon: {
    fontSize: 16,
    lineHeight: 1,
    marginTop: 1,
    flexShrink: 0,
    width: 20,
    textAlign: "center",
  },
  urlInfo: {
    flex: 1,
    minWidth: 0,
  },
  urlLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 2,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  urlDesc: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 4,
    lineHeight: 1.5,
  },
  urlPath: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "rgba(200,255,0,0.45)",
    background: "rgba(200,255,0,0.05)",
    border: "1px solid rgba(200,255,0,0.08)",
    borderRadius: 5,
    padding: "2px 7px",
    display: "inline-block",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  urlActions: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },

  // Tag
  tag: {
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 8,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  // Buttons
  copyBtn: {
    background: "rgba(200,255,0,0.08)",
    border: "1px solid rgba(200,255,0,0.15)",
    color: "#c8ff00",
    borderRadius: 7,
    padding: "5px 12px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .15s",
    whiteSpace: "nowrap",
  },
  copyBtnDone: {
    background: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.25)",
    color: "#4ade80",
  },
  openBtn: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.4)",
    borderRadius: 7,
    padding: "5px 9px",
    fontSize: 12,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all .15s",
  },

  // Loading / empty
  loading: {
    padding: "14px 20px",
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
  },
  empty: {
    padding: "14px 20px",
    fontSize: 13,
    color: "rgba(255,255,255,0.3)",
  },

  // Quick reference grid
  refGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 12,
    padding: "16px 20px",
  },
  refCard: {
    position: "relative",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    padding: "14px 14px 14px 18px",
    overflow: "hidden",
  },
  refCardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: "0 0 0 0",
  },
  refAudience: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  refAudienceLabel: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
  },
  refUrls: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    marginBottom: 10,
  },
  refUrlRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  refUrlText: {
    fontSize: 11,
    fontFamily: "monospace",
    color: "rgba(200,255,0,0.5)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  },
  refNote: {
    fontSize: 11,
    color: "rgba(255,255,255,0.25)",
    lineHeight: 1.5,
  },
};
