import { useEffect } from "react";
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/director/dashboard", icon: "⊞", label: "Dashboard" },
  { to: "/director/tournaments", icon: "🏆", label: "Tournaments" },
  { to: "/director/events", icon: "📋", label: "Events" },
  { to: "/director/matches", icon: "🏸", label: "Matches" },
  { to: "/director/players", icon: "👤", label: "Players" },
  { to: "/director/sponsors", icon: "★", label: "Sponsors" },
  { to: "/director/venues", icon: "📍", label: "Venues" },
];

export default function DirectorLayout() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) navigate("/director/login", { replace: true });
  }, [token, navigate]);

  if (!token) return null;

  return (
    <div style={S.shell}>
      <style>{CSS}</style>

      <aside style={S.sidebar}>
        <div style={S.logo}>
          <span style={S.logoIcon}>🏸</span>
          <div>
            <div style={S.logoName}>Director</div>
            <div style={S.logoSub}>Portal</div>
          </div>
        </div>

        <nav style={S.nav}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                ...S.navLink,
                ...(isActive ? S.navActive : {}),
              })}
            >
              <span style={S.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={S.footer}>
          <div style={S.userChip}>
            <div style={S.avatar}>
              {user?.username?.[0]?.toUpperCase() ?? "D"}
            </div>
            <div>
              <div style={S.userName}>{user?.username ?? "Director"}</div>
              <div style={S.userRole}>Tournament Director</div>
            </div>
          </div>
          <button
            style={S.logoutBtn}
            onClick={() => {
              logout();
              navigate("/director/login");
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main style={S.main}>
        <Outlet />
      </main>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }
  a { text-decoration: none; }
  input:focus, select:focus { outline: none; border-color: rgba(200,255,0,0.5) !important; box-shadow: 0 0 0 3px rgba(200,255,0,0.08); }
  select option { background: #1a1a1a; color: #fff; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;

const S = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#0a0a0a",
    fontFamily: "'DM Sans', sans-serif",
    color: "#fff",
  },
  sidebar: {
    width: 220,
    minHeight: "100vh",
    background: "#0d0d0d",
    borderRight: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    padding: "24px 0",
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 10,
  },
  logo: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 20px 28px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  logoIcon: { fontSize: 28 },
  logoName: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: 18,
    color: "#c8ff00",
    lineHeight: 1,
  },
  logoSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    letterSpacing: "2px",
    textTransform: "uppercase",
  },
  nav: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "20px 12px",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "11px 12px",
    borderRadius: 10,
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    fontWeight: 500,
    transition: "background 0.15s, color 0.15s",
  },
  navActive: { background: "rgba(200,255,0,0.08)", color: "#c8ff00" },
  navIcon: { fontSize: 16, width: 20, textAlign: "center" },
  footer: {
    padding: "20px 16px 0",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  userChip: { display: "flex", alignItems: "center", gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "#c8ff00",
    color: "#0a0a0a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: { fontSize: 13, color: "#fff", fontWeight: 500 },
  userRole: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  logoutBtn: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  },
  main: {
    marginLeft: 220,
    flex: 1,
    padding: "40px 40px 60px",
    minHeight: "100vh",
  },
};
