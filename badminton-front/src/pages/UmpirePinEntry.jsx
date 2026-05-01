// src/pages/UmpirePinEntry.jsx
//
// Route: /umpire/:matchId
//
// The umpire lands here, enters the 4-digit PIN.
// On success the HMAC token is stored in localStorage and they are
// navigated to /umpire/:matchId/score.

import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function UmpirePinEntry() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [digits, setDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  useEffect(() => {
    // If token already exists for this match, skip to panel
    const stored = localStorage.getItem(`umpire_token_${matchId}`);
    if (stored) navigate(`/umpire/${matchId}/score`, { replace: true });
    inputRefs[0].current?.focus();
  }, [matchId]);

  const handleDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError('');
    if (value && index < 3) inputRefs[index + 1].current?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    if (e.key === 'Enter') handleSubmit();
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (paste.length === 4) {
      setDigits(paste.split(''));
      inputRefs[3].current?.focus();
    }
  };

  const handleSubmit = async () => {
    const pin = digits.join('');
    if (pin.length < 4) {
      setError('Please enter all 4 digits.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/matches/${matchId}/verify_pin/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid PIN.');
      }
      localStorage.setItem(`umpire_token_${matchId}`, data.token);
      navigate(`/umpire/${matchId}/score`);
    } catch (err) {
      setError(err.message);
      setShake(true);
      setDigits(['', '', '', '']);
      inputRefs[0].current?.focus();
      setTimeout(() => setShake(false), 600);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card} className={shake ? 'shake' : ''}>

        {/* Shuttle icon */}
        <div style={styles.iconWrap}>
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
            <circle cx="24" cy="24" r="22" stroke="#e8ff47" strokeWidth="2" />
            <path d="M16 32 L32 16" stroke="#e8ff47" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="32" cy="16" r="4" fill="#e8ff47" />
          </svg>
        </div>

        <h1 style={styles.title}>UMPIRE ACCESS</h1>
        <p style={styles.subtitle}>Match #{matchId} · Enter 4-digit PIN</p>

        <div style={styles.digitRow} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={inputRefs[i]}
              type="tel"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={{
                ...styles.digitInput,
                borderColor: d ? '#e8ff47' : 'rgba(255,255,255,0.15)',
                color: d ? '#e8ff47' : '#fff',
                boxShadow: d ? '0 0 16px rgba(232,255,71,0.3)' : 'none',
              }}
            />
          ))}
        </div>

        {error && (
          <div style={styles.error}>
            <span>⚠</span> {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || digits.join('').length < 4}
          style={{
            ...styles.button,
            opacity: loading || digits.join('').length < 4 ? 0.4 : 1,
            cursor: loading || digits.join('').length < 4 ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? (
            <span style={styles.spinner}>◌</span>
          ) : (
            'ENTER COURT →'
          )}
        </button>

        <p style={styles.hint}>PIN is set by the tournament administrator</p>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap');

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

        input:focus { outline: none; }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: 'radial-gradient(ellipse at 50% 0%, #1a2a0a 0%, #0a0c0a 70%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    padding: '24px',
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '48px 40px',
    maxWidth: '380px',
    width: '100%',
    textAlign: 'center',
    backdropFilter: 'blur(12px)',
  },
  iconWrap: {
    marginBottom: '24px',
    display: 'flex',
    justifyContent: 'center',
  },
  title: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '36px',
    letterSpacing: '4px',
    color: '#fff',
    margin: '0 0 8px',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '14px',
    margin: '0 0 40px',
    letterSpacing: '0.5px',
  },
  digitRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '28px',
  },
  digitInput: {
    width: '60px',
    height: '72px',
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid',
    borderRadius: '12px',
    fontSize: '32px',
    fontFamily: "'Bebas Neue', sans-serif",
    textAlign: 'center',
    transition: 'all 0.15s ease',
    caretColor: '#e8ff47',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '13px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  button: {
    width: '100%',
    padding: '18px',
    background: '#e8ff47',
    color: '#0a0c0a',
    border: 'none',
    borderRadius: '12px',
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: '18px',
    letterSpacing: '2px',
    marginBottom: '20px',
    transition: 'transform 0.1s ease, opacity 0.2s ease',
  },
  spinner: {
    display: 'inline-block',
    animation: 'spin 1s linear infinite',
  },
  hint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: '12px',
    margin: 0,
  },
};
