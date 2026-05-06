// src/pages/UmpireLogin.jsx
//
// Simple JWT login for umpires.
// On success → stores access + refresh tokens → navigates to /umpire/dashboard
// PIN flow is still available via /umpire/pin (UmpirePinEntry — unchanged).

import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function UmpireLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Invalid username or password.");
        return;
      }

      const { access, refresh } = await res.json();
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      navigate("/umpire/dashboard");
    } catch {
      setError("Network error. Is the server reachable?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Icon */}
        <div style={S.iconWrap}>
          <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#e8ff47" strokeWidth="2" />
            <path
              d="M16 32 L32 16"
              stroke="#e8ff47"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <circle cx="32" cy="16" r="4" fill="#e8ff47" />
          </svg>
        </div>

        <h1 style={S.title}>UMPIRE LOGIN</h1>
        <p style={S.subtitle}>Sign in to see your assigned matches</p>

        {error && <div style={S.error}>⚠ {error}</div>}

        <form onSubmit={handleSubmit} style={S.form}>
          <div style={S.field}>
            <label style={S.label}>Username</label>
            <input
              style={S.input}
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              required
              autoFocus
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Password</label>
            <input
              style={S.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...S.submitBtn,
              opacity: loading ? 0.5 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "SIGNING IN…" : "SIGN IN →"}
          </button>
        </form>

        {/* PIN fallback */}
        <div style={S.divider}>or</div>
        <button style={S.pinBtn} onClick={() => navigate("/umpire/pin")}>
          🔢 Enter match via PIN instead
        </button>
      </div>
    </div>
  );
}

const S = {
  page: {
    minHeight: "100vh",
    background: "#0a0e1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    padding: "24px",
  },
  card: {
    background: "#111827",
    borderRadius: "16px",
    border: "1px solid #1e293b",
    padding: "40px 32px",
    width: "100%",
    maxWidth: "380px",
  },
  iconWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "20px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#f8fafc",
    textAlign: "center",
    margin: "0 0 8px",
    letterSpacing: "0.1em",
  },
  subtitle: {
    fontSize: "13px",
    color: "#64748b",
    textAlign: "center",
    margin: "0 0 28px",
  },
  error: {
    background: "#450a0a",
    color: "#fca5a5",
    padding: "10px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    marginBottom: "16px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "12px",
    color: "#94a3b8",
    fontWeight: "500",
  },
  input: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "11px 14px",
    fontSize: "14px",
    color: "#f1f5f9",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  submitBtn: {
    background: "#e8ff47",
    color: "#0a0e1a",
    border: "none",
    borderRadius: "8px",
    padding: "13px",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    marginTop: "4px",
    width: "100%",
  },
  divider: {
    textAlign: "center",
    color: "#334155",
    fontSize: "12px",
    margin: "20px 0",
  },
  pinBtn: {
    width: "100%",
    background: "transparent",
    border: "1px solid #1e293b",
    borderRadius: "8px",
    padding: "11px",
    fontSize: "13px",
    color: "#94a3b8",
    cursor: "pointer",
  },
};
