import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try { await login(username, password); }
    catch { setError("Invalid username or password."); }
    finally { setLoading(false); }
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.left}>
        <div style={S.brand}>
          <div style={S.shuttle}>🏸</div>
          <div style={S.brandName}>BWF Director</div>
          <div style={S.brandSub}>Tournament Management Portal</div>
        </div>
        <div style={S.tagline}>
          "Every great match<br />starts with a great draw."
        </div>
      </div>

      <div style={S.right}>
        <form style={S.card} onSubmit={handleSubmit}>
          <div style={S.cardHead}>
            <div style={S.cardTitle}>Director Login</div>
            <div style={S.cardSub}>Sign in with your credentials</div>
          </div>

          {error && <div style={S.err}>{error}</div>}

          <div style={S.field}>
            <label style={S.label}>Username</label>
            <input
              style={S.input}
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="director@tournament"
              required
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button style={{ ...S.btn, opacity: loading ? 0.6 : 1 }} disabled={loading}>
            {loading ? "Signing in…" : "Sign In →"}
          </button>

          <div style={S.hint}>
            Access restricted to tournament directors only.
          </div>
        </form>
      </div>
    </div>
  );
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }
  input:focus { outline: none; border-color: #c8ff00 !important; box-shadow: 0 0 0 3px rgba(200,255,0,0.15); }
`;

const S = {
  page: { display: "flex", minHeight: "100vh", background: "#0a0a0a" },
  left: {
    flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: "60px", background: "linear-gradient(135deg, #0f1a00 0%, #1a2d00 50%, #0a0a0a 100%)",
    borderRight: "1px solid rgba(200,255,0,0.1)",
  },
  brand: { display: "flex", flexDirection: "column", gap: 12 },
  shuttle: { fontSize: 48 },
  brandName: { fontFamily: "'DM Serif Display', serif", fontSize: 42, color: "#c8ff00", letterSpacing: "-1px" },
  brandSub:  { fontSize: 14, color: "rgba(200,255,0,0.5)", letterSpacing: "2px", textTransform: "uppercase" },
  tagline: {
    fontFamily: "'DM Serif Display', serif", fontSize: 28, color: "rgba(255,255,255,0.2)",
    lineHeight: 1.4, fontStyle: "italic",
  },
  right: { width: 480, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 },
  card: {
    width: "100%", background: "#111", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20, padding: "48px 40px", display: "flex", flexDirection: "column", gap: 24,
  },
  cardHead: { display: "flex", flexDirection: "column", gap: 6 },
  cardTitle: { fontFamily: "'DM Serif Display', serif", fontSize: 30, color: "#fff" },
  cardSub:   { fontSize: 14, color: "rgba(255,255,255,0.4)" },
  err: {
    background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.3)",
    color: "#ff6b6b", borderRadius: 10, padding: "12px 16px", fontSize: 13,
  },
  field: { display: "flex", flexDirection: "column", gap: 8 },
  label: { fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" },
  input: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 10, padding: "14px 16px", color: "#fff", fontSize: 15,
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  btn: {
    background: "#c8ff00", color: "#0a0a0a", border: "none", borderRadius: 10,
    padding: "16px", fontSize: 15, fontWeight: 700, cursor: "pointer",
    transition: "opacity 0.2s", letterSpacing: "0.5px",
  },
  hint: { fontSize: 12, color: "rgba(255,255,255,0.2)", textAlign: "center" },
};
