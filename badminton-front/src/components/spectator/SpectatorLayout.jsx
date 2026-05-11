// src/components/spectator/SpectatorLayout.jsx
//
// Shared layout shell — matches the director portal aesthetic exactly.
// Background: linear-gradient(135deg, #0f1a00 0%, #1a2d00 50%, #0a0a0a 100%)
// Accent: #c8ff00 · Fonts: DM Serif Display + DM Sans

import { Link, useNavigate } from "react-router-dom";

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', sans-serif;
    background: linear-gradient(135deg, #0f1a00 0%, #1a2d00 50%, #0a0a0a 100%);
    background-attachment: fixed;
    color: #fff;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }
  a { text-decoration: none; }
  button { font-family: 'DM Sans', sans-serif; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(200,255,0,0.15); border-radius: 2px; }
  .scroll-row { scrollbar-width: none; -ms-overflow-style: none; }
  .scroll-row::-webkit-scrollbar { display: none; }
  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: .55; transform: scale(1.35); }
  }
  @keyframes slideUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .spectator-page { animation: fadeIn 0.22s ease; }
  button, a { -webkit-tap-highlight-color: transparent; }
`;

// Shared skeleton style — used by all pages
export const SKEL_STYLE = {
  background:
    "linear-gradient(90deg, rgba(200,255,0,0.04) 25%, rgba(200,255,0,0.08) 50%, rgba(200,255,0,0.04) 75%)",
  backgroundSize: "200% 100%",
  animation: "shimmer 1.4s infinite",
  borderRadius: 6,
  display: "block",
};

// ─── Nav bar ──────────────────────────────────────────────────────────────────

function NavBar({ title, breadcrumbs, liveCount }) {
  const navigate = useNavigate();
  const backTo =
    breadcrumbs?.length >= 2 ? breadcrumbs[breadcrumbs.length - 2]?.to : null;

  return (
    <div style={S.nav}>
      <div style={S.navInner}>
        {/* Left — back or logo */}
        <div style={S.navLeft}>
          {backTo ? (
            <button
              style={S.backBtn}
              onClick={() => navigate(backTo)}
              aria-label="Back"
            >
              <span style={S.backArrow}>←</span>
            </button>
          ) : (
            <Link to="/spectator">
              <span style={{ fontSize: 22 }}>🏸</span>
            </Link>
          )}
        </div>

        {/* Centre — page title */}
        {title && (
          <div style={S.navTitle} title={title}>
            {title}
          </div>
        )}

        {/* Right — live badge */}
        <div style={S.navRight}>
          {liveCount > 0 && (
            <div style={S.liveBadge}>
              <span style={S.liveDot} />
              <span style={S.liveText}>{liveCount} live</span>
            </div>
          )}
        </div>
      </div>

      {/* Breadcrumb trail */}
      {breadcrumbs?.length > 1 && (
        <div style={S.breadcrumb} className="scroll-row">
          {breadcrumbs.map((c, i) => (
            <span key={i} style={S.crumbItem}>
              {i > 0 && <span style={S.crumbSep}>›</span>}
              {c.to && i < breadcrumbs.length - 1 ? (
                <Link to={c.to} style={S.crumbLink}>
                  {c.label}
                </Link>
              ) : (
                <span style={S.crumbCurrent}>{c.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Layout shell ─────────────────────────────────────────────────────────────

export default function SpectatorLayout({
  children,
  title,
  breadcrumbs,
  liveCount = 0,
}) {
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={S.shell}>
        <NavBar title={title} breadcrumbs={breadcrumbs} liveCount={liveCount} />
        <main style={S.main} className="spectator-page">
          {children}
        </main>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  shell: {
    minHeight: "100vh",
    // Transparent so body gradient shows through
    background: "transparent",
    display: "flex",
    flexDirection: "column",
  },
  nav: {
    position: "sticky",
    top: 0,
    zIndex: 30,
    // Slightly darkened glass over the gradient
    background: "rgba(10, 20, 0, 0.75)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(200,255,0,0.08)",
  },
  navInner: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 70px",
    alignItems: "center",
    padding: "0 20px",
    height: 54,
    maxWidth: 920,
    margin: "0 auto",
    width: "100%",
  },
  navLeft: { display: "flex", alignItems: "center" },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "8px 8px 8px 0",
    display: "flex",
    alignItems: "center",
  },
  backArrow: { fontSize: 20, color: "rgba(200,255,0,0.5)", lineHeight: 1 },
  navTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#fff",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  navRight: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  liveBadge: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "rgba(200,255,0,0.1)",
    border: "1px solid rgba(200,255,0,0.25)",
    borderRadius: 20,
    padding: "3px 10px",
  },
  liveDot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#c8ff00",
    animation: "pulse 1.5s infinite",
    flexShrink: 0,
  },
  liveText: { fontSize: 11, fontWeight: 700, color: "#c8ff00" },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    padding: "4px 20px 7px",
    maxWidth: 920,
    margin: "0 auto",
    width: "100%",
    overflowX: "auto",
  },
  crumbItem: { display: "flex", alignItems: "center", gap: 2, flexShrink: 0 },
  crumbSep: { fontSize: 11, color: "rgba(200,255,0,0.15)", margin: "0 3px" },
  crumbLink: { fontSize: 11, color: "rgba(200,255,0,0.35)", fontWeight: 500 },
  crumbCurrent: { fontSize: 11, color: "rgba(200,255,0,0.6)", fontWeight: 600 },
  main: {
    flex: 1,
    maxWidth: 920,
    margin: "0 auto",
    width: "100%",
    padding: "0 0 80px",
  },
};
