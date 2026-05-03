import { useAuth } from "../context/AuthContext";

const NAV = [
  { id: "dashboard",   icon: "⊞", label: "Dashboard" },
  { id: "tournaments", icon: "🏆", label: "Tournaments" },
  { id: "matches",     icon: "🏸", label: "Matches" },
  { id: "players",     icon: "👤", label: "Players" },
  { id: "sponsors",    icon: "★",  label: "Sponsors" },
  { id: "venues",      icon: "📍", label: "Venues" },
];

export default function Sidebar({ active, onNav }) {
  const { user, logout } = useAuth();

  return (
    <aside style={S.sidebar}>
      <div style={S.logo}>
        <span style={S.logoIcon}>🏸</span>
        <div>
          <div style={S.logoName}>Director</div>
          <div style={S.logoSub}>Portal</div>
        </div>
      </div>

      <nav style={S.nav}>
        {NAV.map(item => (
          <button
            key={item.id}
            style={{ ...S.navBtn, ...(active === item.id ? S.navActive : {}) }}
            onClick={() => onNav(item.id)}
          >
            <span style={S.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
            {active === item.id && <span style={S.activeBar} />}
          </button>
        ))}
      </nav>

      <div style={S.footer}>
        <div style={S.userChip}>
          <div style={S.avatar}>{user?.username?.[0]?.toUpperCase() ?? "D"}</div>
          <div>
            <div style={S.userName}>{user?.username ?? "Director"}</div>
            <div style={S.userRole}>Tournament Director</div>
          </div>
        </div>
        <button style={S.logoutBtn} onClick={logout}>Sign out</button>
      </div>
    </aside>
  );
}

const S = {
  sidebar: {
    width: 220, minHeight: "100vh", background: "#0d0d0d",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex", flexDirection: "column", padding: "24px 0",
    position: "fixed", top: 0, left: 0, bottom: 0,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "0 20px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoIcon: { fontSize: 28 },
  logoName: { fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#c8ff00", lineHeight: 1 },
  logoSub:  { fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" },
  nav:      { flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "20px 12px" },
  navBtn: {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "11px 12px", border: "none", borderRadius: 10,
    background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 13,
    fontWeight: 500, cursor: "pointer", textAlign: "left", position: "relative",
    transition: "background 0.15s, color 0.15s",
  },
  navActive: { background: "rgba(200,255,0,0.08)", color: "#c8ff00" },
  navIcon:   { fontSize: 16, width: 20, textAlign: "center" },
  activeBar: {
    position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
    width: 3, height: 20, background: "#c8ff00", borderRadius: "2px 0 0 2px",
  },
  footer: {
    padding: "20px 16px 0", borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex", flexDirection: "column", gap: 12,
  },
  userChip:  { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 34, height: 34, borderRadius: "50%", background: "#c8ff00",
    color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 14,
  },
  userName: { fontSize: 13, color: "#fff", fontWeight: 500 },
  userRole: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  logoutBtn: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8, padding: "8px 12px", color: "rgba(255,255,255,0.4)",
    fontSize: 12, cursor: "pointer", width: "100%", textAlign: "left",
    transition: "color 0.15s",
  },
};
