// src/pages/UmpirePinEntry.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ─── Step 1: Match Selector ───────────────────────────────────────────────────
function MatchSelector({ onSelect }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [liveRes, upcomingRes] = await Promise.all([
          fetch(`${API_BASE}/matches/live/`),
          fetch(`${API_BASE}/matches/upcoming/`),
        ]);
        const live = await liveRes.json();
        const upcoming = await upcomingRes.json();
        const liveArr = Array.isArray(live) ? live : (live.results ?? []);
        const upcomingArr = Array.isArray(upcoming)
          ? upcoming
          : (upcoming.results ?? []);
        const seen = new Set();
        const combined = [...liveArr, ...upcomingArr].filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        if (combined.length === 0)
          setError(
            "No live or upcoming matches found.\nAsk the director to create a match first.",
          );
        setMatches(combined);
      } catch {
        setError("Could not load matches. Is the server running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading)
    return (
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <span style={S.loadingText}>Loading matches…</span>
      </div>
    );

  if (error)
    return (
      <div style={S.errorBox}>
        {error.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    );

  return (
    <div style={S.matchList}>
      {matches.map((m) => {
        const team1 = [m.player1_team1_name, m.player2_team1_name]
          .filter(Boolean)
          .join(" / ");
        const team2 = [m.player1_team2_name, m.player2_team2_name]
          .filter(Boolean)
          .join(" / ");
        const time = m.scheduled_time
          ? new Date(m.scheduled_time).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : null;
        return (
          <button key={m.id} style={S.matchCard} onClick={() => onSelect(m)}>
            <div style={S.matchCardTop}>
              <div
                style={{
                  ...S.matchStatusDot,
                  background: m.status === "Live" ? "#22c55e" : "#f59e0b",
                  boxShadow:
                    m.status === "Live"
                      ? "0 0 8px rgba(34,197,94,0.6)"
                      : "none",
                }}
              />
              <span style={S.matchStatusText}>{m.status}</span>
              {time && <span style={S.matchTime}>{time}</span>}
              <span style={S.matchId}>#{m.id}</span>
            </div>
            <div style={S.matchTeams}>
              <span style={S.matchTeamName}>{team1 || "Team 1"}</span>
              <span style={S.matchVs}>VS</span>
              <span style={S.matchTeamName}>{team2 || "Team 2"}</span>
            </div>
            {m.tournament_name && (
              <div style={S.matchTournament}>{m.tournament_name}</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Step 2a: PIN Entry ───────────────────────────────────────────────────────
function PinEntry({ match, onBack, onSwitchMode }) {
  const navigate = useNavigate();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    const stored = localStorage.getItem(`umpire_token_${match.id}`);
    if (stored) navigate(`/umpire/${match.id}/score`, { replace: true });
    else inputRefs[0].current?.focus();
  }, [match.id]);

  const clearPin = () => {
    setDigits(["", "", "", ""]);
    setTimeout(() => inputRefs[0].current?.focus(), 50);
  };

  const triggerShake = (msg) => {
    setError(msg);
    setShake(true);
    clearPin();
    setTimeout(() => setShake(false), 600);
  };

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError("");
    if (value && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0)
      inputRefs[index - 1].current?.focus();
    if (e.key === "Enter") handleSubmit();
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 4);
    if (paste.length === 4) {
      setDigits(paste.split(""));
      inputRefs[3].current?.focus();
    }
  };

  const handleSubmit = async () => {
    const pin = digits.join("");
    if (pin.length < 4) {
      triggerShake("Enter all 4 digits.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/matches/${match.id}/verify_pin/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        triggerShake(
          res.status === 403
            ? "Wrong PIN. Try again."
            : res.status === 404
              ? "Match not found."
              : data.error || data.detail || `Error ${res.status}`,
        );
        return;
      }
      localStorage.setItem(`umpire_token_${match.id}`, data.token);
      navigate(`/umpire/${match.id}/score`);
    } catch {
      triggerShake("Network error. Is the server reachable?");
    } finally {
      setLoading(false);
    }
  };

  const team1 = [match.player1_team1_name, match.player2_team1_name]
    .filter(Boolean)
    .join(" / ");
  const team2 = [match.player1_team2_name, match.player2_team2_name]
    .filter(Boolean)
    .join(" / ");

  return (
    <div style={{ width: "100%" }}>
      <MatchSummary match={match} team1={team1} team2={team2} onBack={onBack} />

      {/* Mode toggle */}
      <div style={S.modeToggle}>
        <button style={{ ...S.modeBtn, ...S.modeBtnActive }}>🔢 PIN</button>
        <button style={S.modeBtn} onClick={onSwitchMode}>
          🔑 Password
        </button>
      </div>

      <div
        style={S.digitRow}
        onPaste={handlePaste}
        className={shake ? "shake" : ""}
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            style={{
              ...S.digitInput,
              borderColor: error
                ? "rgba(255,100,100,0.7)"
                : d
                  ? "#e8ff47"
                  : "rgba(255,255,255,0.15)",
              color: error ? "#ff6b6b" : d ? "#e8ff47" : "#fff",
              boxShadow: error
                ? "0 0 16px rgba(255,100,100,0.2)"
                : d
                  ? "0 0 16px rgba(232,255,71,0.3)"
                  : "none",
            }}
          />
        ))}
      </div>

      <div
        style={{
          ...S.errorMsg,
          opacity: error ? 1 : 0,
          transform: error ? "translateY(0)" : "translateY(-4px)",
        }}
      >
        ⚠ {error || "placeholder"}
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || digits.join("").length < 4}
        style={{
          ...S.submitBtn,
          opacity: loading || digits.join("").length < 4 ? 0.4 : 1,
          cursor:
            loading || digits.join("").length < 4 ? "not-allowed" : "pointer",
        }}
      >
        {loading ? (
          <span style={{ letterSpacing: "2px" }}>CHECKING…</span>
        ) : (
          "ENTER COURT →"
        )}
      </button>
    </div>
  );
}

// ─── Step 2b: Password Entry ──────────────────────────────────────────────────
function PasswordEntry({ match, onBack, onSwitchMode }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const team1 = [match.player1_team1_name, match.player2_team1_name]
    .filter(Boolean)
    .join(" / ");
  const team2 = [match.player1_team2_name, match.player2_team2_name]
    .filter(Boolean)
    .join(" / ");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      // Step 1 — get JWT
      const tokenRes = await fetch("/api/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!tokenRes.ok) {
        setError("Invalid username or password.");
        return;
      }
      const { access } = await tokenRes.json();

      // Step 2 — exchange JWT for match HMAC token
      const matchRes = await fetch(`/api/matches/${match.id}/umpire_token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
      });
      if (!matchRes.ok) {
        setError("Account does not have umpire access to this match.");
        return;
      }
      const { token } = await matchRes.json();

      // Step 3 — store and navigate (same as PIN flow)
      localStorage.setItem(`umpire_token_${match.id}`, token);
      navigate(`/umpire/${match.id}/score`);
    } catch {
      setError("Network error. Is the server reachable?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <MatchSummary match={match} team1={team1} team2={team2} onBack={onBack} />

      {/* Mode toggle */}
      <div style={S.modeToggle}>
        <button style={S.modeBtn} onClick={onSwitchMode}>
          🔢 PIN
        </button>
        <button style={{ ...S.modeBtn, ...S.modeBtnActive }}>
          🔑 Password
        </button>
      </div>

      <form onSubmit={handleSubmit} style={S.pwForm}>
        {error && <div style={S.pwError}>⚠ {error}</div>}
        <div style={S.pwField}>
          <label style={S.pwLabel}>Username</label>
          <input
            style={S.pwInput}
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="umpire_username"
            required
            autoFocus
          />
        </div>
        <div style={S.pwField}>
          <label style={S.pwLabel}>Password</label>
          <input
            style={S.pwInput}
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
          {loading ? (
            <span style={{ letterSpacing: "2px" }}>SIGNING IN…</span>
          ) : (
            "ENTER COURT →"
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Shared match summary bar ─────────────────────────────────────────────────
function MatchSummary({ match, team1, team2, onBack }) {
  return (
    <div style={S.selectedMatch}>
      <div style={S.selectedMatchTeams}>
        {team1 || "Team 1"}{" "}
        <span style={{ color: "rgba(255,255,255,0.3)" }}>vs</span>{" "}
        {team2 || "Team 2"}
      </div>
      <div style={S.selectedMatchMeta}>
        Match #{match.id}
        {match.status === "Live" && <span style={S.livePill}>LIVE</span>}
      </div>
      <button style={S.changeMatchBtn} onClick={onBack}>
        ← Change match
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UmpirePinEntry() {
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [mode, setMode] = useState("pin"); // "pin" | "password"

  const handleSelectMatch = (match) => {
    setMode("pin"); // reset to PIN mode on new match selection
    setSelectedMatch(match);
  };

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.card}>
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

        <h1 style={S.title}>UMPIRE ACCESS</h1>
        <p style={S.subtitle}>
          {!selectedMatch
            ? "Select your match"
            : mode === "pin"
              ? "Enter your 4-digit PIN"
              : "Sign in with password"}
        </p>

        {!selectedMatch ? (
          <MatchSelector onSelect={handleSelectMatch} />
        ) : mode === "pin" ? (
          <PinEntry
            match={selectedMatch}
            onBack={() => setSelectedMatch(null)}
            onSwitchMode={() => setMode("password")}
          />
        ) : (
          <PasswordEntry
            match={selectedMatch}
            onBack={() => setSelectedMatch(null)}
            onSwitchMode={() => setMode("pin")}
          />
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; background: #0a0a0a; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    20%,60% { transform: translateX(-8px); }
    40%,80% { transform: translateX(8px); }
  }
  .shake { animation: shake 0.4s ease; }
`;

const S = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0a 0%, #0f1a00 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "24px",
    padding: "40px 36px",
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
    backdropFilter: "blur(20px)",
  },
  iconWrap: { marginBottom: "20px", display: "flex", justifyContent: "center" },
  title: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: "28px",
    color: "#fff",
    letterSpacing: "4px",
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "1.5px",
    marginBottom: "28px",
    textTransform: "uppercase",
  },

  // Match list
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "24px 0",
  },
  spinner: {
    width: "24px",
    height: "24px",
    border: "2px solid rgba(255,255,255,0.1)",
    borderTopColor: "#e8ff47",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: "13px",
    letterSpacing: "1px",
  },
  errorBox: {
    background: "rgba(255,100,100,0.08)",
    border: "1px solid rgba(255,100,100,0.2)",
    borderRadius: "10px",
    color: "#ff8080",
    fontSize: "13px",
    lineHeight: "1.6",
    padding: "16px",
    marginBottom: "8px",
  },
  matchList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxHeight: "360px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  matchCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "12px",
    padding: "14px 16px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
    width: "100%",
  },
  matchCardTop: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    marginBottom: "8px",
  },
  matchStatusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  matchStatusText: {
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "rgba(255,255,255,0.4)",
  },
  matchTime: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.3)",
    marginLeft: "auto",
  },
  matchId: { fontSize: "11px", color: "rgba(255,255,255,0.2)" },
  matchTeams: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  matchTeamName: { fontSize: "15px", fontWeight: "600", color: "#fff" },
  matchVs: {
    fontSize: "10px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.2)",
    letterSpacing: "2px",
  },
  matchTournament: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.25)",
    marginTop: "6px",
    letterSpacing: "0.5px",
  },

  // Shared match summary
  selectedMatch: {
    background: "rgba(232,255,71,0.06)",
    border: "1px solid rgba(232,255,71,0.15)",
    borderRadius: "12px",
    padding: "14px 16px",
    marginBottom: "20px",
    textAlign: "left",
  },
  selectedMatchTeams: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#fff",
    marginBottom: "4px",
  },
  selectedMatchMeta: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.35)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  livePill: {
    background: "rgba(34,197,94,0.15)",
    border: "1px solid rgba(34,197,94,0.3)",
    borderRadius: "20px",
    padding: "1px 8px",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "1px",
    color: "#22c55e",
  },
  changeMatchBtn: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.3)",
    fontSize: "12px",
    cursor: "pointer",
    padding: "6px 0 0",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.5px",
  },

  // Mode toggle
  modeToggle: {
    display: "flex",
    gap: "8px",
    marginBottom: "24px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    padding: "4px",
  },
  modeBtn: {
    flex: 1,
    padding: "8px",
    border: "none",
    borderRadius: "8px",
    background: "transparent",
    color: "rgba(255,255,255,0.35)",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    transition: "all 0.15s",
  },
  modeBtnActive: { background: "rgba(232,255,71,0.12)", color: "#e8ff47" },

  // PIN inputs
  digitRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    marginBottom: "8px",
  },
  digitInput: {
    width: "62px",
    height: "74px",
    background: "rgba(255,255,255,0.05)",
    border: "2px solid",
    borderRadius: "14px",
    textAlign: "center",
    fontSize: "28px",
    fontWeight: "700",
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.15s, color 0.15s, box-shadow 0.15s",
  },
  errorMsg: {
    fontSize: "13px",
    color: "#ff6b6b",
    marginBottom: "20px",
    minHeight: "20px",
    transition: "opacity 0.2s, transform 0.2s",
  },

  // Password form
  pwForm: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    textAlign: "left",
  },
  pwField: { display: "flex", flexDirection: "column", gap: "6px" },
  pwLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  pwInput: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    padding: "12px 14px",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "'DM Sans', sans-serif",
  },
  pwError: {
    background: "rgba(255,60,60,0.08)",
    border: "1px solid rgba(255,60,60,0.2)",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#ff8080",
    fontSize: "13px",
  },

  // Submit
  submitBtn: {
    width: "100%",
    padding: "16px",
    background: "linear-gradient(135deg, #e8ff47, #c8ff00)",
    border: "none",
    borderRadius: "12px",
    color: "#0a0a0a",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "2px",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    marginTop: "8px",
    transition: "opacity 0.2s",
  },
};
