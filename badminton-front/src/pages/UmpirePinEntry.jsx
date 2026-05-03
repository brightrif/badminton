// src/pages/UmpirePinEntry.jsx
//
// Fixes:
//  1. Match selector — umpire picks their match from a list of live/upcoming matches
//     instead of the match ID being hardcoded in the URL
//  2. Proper error display — wrong PIN shows clear error message with shake animation
//  3. PIN cleared on wrong attempt so umpire can retry cleanly
//  4. Route is now /umpire (no match ID in URL) — match ID comes from the selector

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
        // Fetch live matches first, then upcoming
        const [liveRes, upcomingRes] = await Promise.all([
          fetch(`${API_BASE}/matches/live/`),
          fetch(`${API_BASE}/matches/upcoming/`),
        ]);
        const liveData = await liveRes.json();
        const upcomingData = await upcomingRes.json();

        const live = Array.isArray(liveData)
          ? liveData
          : (liveData.results ?? []);
        const upcoming = Array.isArray(upcomingData)
          ? upcomingData
          : (upcomingData.results ?? []);

        // Live matches first, then upcoming — deduplicated by id
        const seen = new Set();
        const combined = [...live, ...upcoming].filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        if (combined.length === 0) {
          setError(
            "No live or upcoming matches found.\nAsk the admin to create a match first.",
          );
        }
        setMatches(combined);
      } catch (e) {
        setError("Could not load matches. Is the server running?");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <div style={S.spinner} />
        <span style={S.loadingText}>Loading matches…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={S.errorBox}>
        {error.split("\n").map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    );
  }

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
          ? new Date(m.scheduled_time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";

        return (
          <button key={m.id} style={S.matchCard} onClick={() => onSelect(m)}>
            <div style={S.matchCardTop}>
              <span
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

// ─── Step 2: PIN Entry ────────────────────────────────────────────────────────
function PinEntry({ match, onBack }) {
  const navigate = useNavigate();

  const [digits, setDigits] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    // If already authenticated for this match, skip straight to panel
    const stored = localStorage.getItem(`umpire_token_${match.id}`);
    if (stored) {
      navigate(`/umpire/${match.id}/score`, { replace: true });
    } else {
      inputRefs[0].current?.focus();
    }
  }, [match.id]);

  const clearPin = () => {
    setDigits(["", "", "", ""]);
    setTimeout(() => inputRefs[0].current?.focus(), 50);
  };

  const triggerShake = (message) => {
    setError(message);
    setShake(true);
    clearPin();
    setTimeout(() => setShake(false), 600);
  };

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError(""); // clear error as soon as user starts retyping
    if (value && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
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

      // Always parse the body — even on error it contains a message
      const data = await res.json();

      if (!res.ok) {
        // 403 = wrong PIN, 400 = missing PIN, 404 = match not found
        const message =
          res.status === 403
            ? "Wrong PIN. Try again."
            : res.status === 404
              ? "Match not found."
              : res.status === 400
                ? "PIN is required."
                : data.error || data.detail || `Error ${res.status}`;

        triggerShake(message);
        return;
      }

      // Success — store token and navigate
      localStorage.setItem(`umpire_token_${match.id}`, data.token);
      navigate(`/umpire/${match.id}/score`);
    } catch (e) {
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
      {/* Match summary */}
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

      {/* PIN inputs */}
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
                ? "rgba(255,100,100,0.7)" // red border on error
                : d
                  ? "#e8ff47" // yellow when filled
                  : "rgba(255,255,255,0.15)", // dim when empty
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

      {/* Error message — always in DOM so layout doesn't jump */}
      <div
        style={{
          ...S.errorMsg,
          opacity: error ? 1 : 0,
          transform: error ? "translateY(0)" : "translateY(-4px)",
        }}
      >
        ⚠ {error || "placeholder"}
      </div>

      {/* Submit button */}
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UmpirePinEntry() {
  const [selectedMatch, setSelectedMatch] = useState(null);

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      <div style={S.card}>
        {/* Header */}
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
          {selectedMatch ? "Enter your 4-digit PIN" : "Select your match"}
        </p>

        {/* Two-step flow */}
        {!selectedMatch ? (
          <MatchSelector onSelect={setSelectedMatch} />
        ) : (
          <PinEntry
            match={selectedMatch}
            onBack={() => setSelectedMatch(null)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: "100dvh",
    background: "radial-gradient(ellipse at 50% 0%, #1a2a0a 0%, #0a0c0a 70%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif",
    padding: "24px",
  },
  card: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "20px",
    padding: "40px 32px",
    maxWidth: "420px",
    width: "100%",
    textAlign: "center",
  },
  iconWrap: {
    marginBottom: "20px",
    display: "flex",
    justifyContent: "center",
  },
  title: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "34px",
    letterSpacing: "4px",
    color: "#fff",
    margin: "0 0 6px",
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    margin: "0 0 28px",
    letterSpacing: "0.5px",
  },

  // ── Match list ──
  loadingWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "24px 0",
  },
  spinner: {
    width: "28px",
    height: "28px",
    border: "3px solid rgba(255,255,255,0.1)",
    borderTop: "3px solid #e8ff47",
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
  matchId: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.2)",
  },
  matchTeams: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  matchTeamName: {
    fontSize: "15px",
    fontWeight: "600",
    color: "#fff",
  },
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

  // ── PIN entry ──
  selectedMatch: {
    background: "rgba(232,255,71,0.06)",
    border: "1px solid rgba(232,255,71,0.15)",
    borderRadius: "12px",
    padding: "14px 16px",
    marginBottom: "24px",
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
    borderRadius: "12px",
    fontSize: "34px",
    fontFamily: "'Bebas Neue', sans-serif",
    textAlign: "center",
    transition: "all 0.15s ease",
    caretColor: "#e8ff47",
    outline: "none",
  },
  errorMsg: {
    color: "#ff6b6b",
    fontSize: "13px",
    fontWeight: "500",
    marginBottom: "16px",
    minHeight: "20px",
    transition: "opacity 0.2s ease, transform 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
  },
  submitBtn: {
    width: "100%",
    padding: "18px",
    background: "#e8ff47",
    color: "#0a0c0a",
    border: "none",
    borderRadius: "12px",
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: "18px",
    letterSpacing: "2px",
    transition: "transform 0.1s ease, opacity 0.2s ease",
    marginBottom: "8px",
  },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: #0a0c0a; }

  .shake {
    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
  }
  @keyframes shake {
    10%, 90% { transform: translateX(-3px); }
    20%, 80% { transform: translateX(6px); }
    30%, 50%, 70% { transform: translateX(-6px); }
    40%, 60% { transform: translateX(6px); }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  button:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  button:active:not(:disabled) {
    transform: scale(0.97);
  }
`;
