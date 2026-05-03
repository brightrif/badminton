import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Tournaments from "./pages/Tournaments";
import Matches from "./pages/Matches";
import Players from "./pages/Players";
import Sponsors from "./pages/Sponsors";
import Venues from "./pages/Venues";

const PAGES = {
  dashboard:   Dashboard,
  tournaments: Tournaments,
  matches:     Matches,
  players:     Players,
  sponsors:    Sponsors,
  venues:      Venues,
};

function Portal() {
  const { token } = useAuth();
  const [activePage, setActivePage] = useState("dashboard");

  if (!token) return <Login />;

  const Page = PAGES[activePage] || Dashboard;

  return (
    <div style={S.shell}>
      <style>{CSS}</style>
      <Sidebar active={activePage} onNav={setActivePage} />
      <main style={S.main}>
        <Page />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Portal />
    </AuthProvider>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; }
  body { background: #0a0a0a; font-family: 'DM Sans', sans-serif; color: #fff; -webkit-font-smoothing: antialiased; }
  input, select, button, textarea { font-family: inherit; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: rgba(200,255,0,0.5) !important; box-shadow: 0 0 0 3px rgba(200,255,0,0.1); }
  select option { background: #1a1a1a; color: #fff; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
`;

const S = {
  shell: { display: "flex", minHeight: "100vh", background: "#0a0a0a" },
  main:  { marginLeft: 220, flex: 1, padding: "40px 40px 60px", minHeight: "100vh", overflowY: "auto" },
};
