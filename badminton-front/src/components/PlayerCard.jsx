// src/components/PlayerCard.jsx
// Fixed:
//  - No longer hardcodes Bahrain flag — uses actual country_code
//  - Graceful fallback if photo is missing
//  - Works for both singles (large) and doubles (side-by-side) layouts

import React from 'react';

export default function PlayerCard({ player, secondaryPlayer, isServing }) {
  if (!player) return null;

  return (
    <div style={S.root}>
      {/* Serving indicator */}
      {isServing && (
        <div style={S.servingWrap}>
          <span style={S.servingDot} />
          <span style={S.servingLabel}>SERVING</span>
        </div>
      )}

      {secondaryPlayer ? (
        /* ── Doubles layout ── */
        <div style={S.doublesRow}>
          <PlayerAvatar player={player} isServing={isServing} size={96} />
          <PlayerAvatar player={secondaryPlayer} isServing={false} size={96} />
        </div>
      ) : (
        /* ── Singles layout ── */
        <PlayerAvatar player={player} isServing={isServing} size={128} />
      )}
    </div>
  );
}

function PlayerAvatar({ player, isServing, size }) {
  const initials = player.name
    ? player.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const flagSrc = player.country_code
    ? `https://flagcdn.com/w40/${player.country_code.toLowerCase()}.png`
    : null;

  return (
    <div style={{ ...S.avatarBlock, gap: size > 100 ? '12px' : '8px' }}>
      {/* Photo ring */}
      <div style={{
        ...S.ring,
        width: size + 8,
        height: size + 8,
        background: isServing
          ? 'linear-gradient(135deg, #e8ff47, transparent)'
          : 'rgba(255,255,255,0.06)',
        boxShadow: isServing ? '0 0 24px rgba(232,255,71,0.35)' : 'none',
      }}>
        <img
          src={player.photo_url}
          alt={player.name}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            objectFit: 'cover',
            border: '3px solid rgba(255,255,255,0.1)',
            display: 'block',
          }}
          onError={e => {
            // Replace broken image with an initial-based SVG placeholder
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        {/* Fallback avatar shown when image fails */}
        <div style={{
          ...S.fallbackAvatar,
          width: size,
          height: size,
          fontSize: size * 0.35,
          display: 'none',
        }}>
          {initials}
        </div>
      </div>

      {/* Country badge */}
      {(flagSrc || player.country_name || player.country) && (
        <div style={S.countryBadge}>
          {flagSrc && (
            <img
              src={flagSrc}
              alt={player.country_name || player.country || ''}
              style={S.flagImg}
              onError={e => { e.target.style.display = 'none'; }}
            />
          )}
          <span style={S.countryText}>
            {player.country_name || player.country || ''}
          </span>
        </div>
      )}
    </div>
  );
}

const S = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '8px',
    position: 'relative',
  },
  servingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '4px',
  },
  servingDot: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#e8ff47',
    boxShadow: '0 0 10px rgba(232,255,71,0.8)',
    animation: 'serving-pulse 1.2s ease-in-out infinite',
  },
  servingLabel: {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '2px',
    color: '#e8ff47',
  },
  doublesRow: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
  },
  avatarBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  ring: {
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'box-shadow 0.3s ease, background 0.3s ease',
    flexShrink: 0,
  },
  fallbackAvatar: {
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.08)',
    border: '3px solid rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Bebas Neue', cursive",
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '2px',
  },
  countryBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '3px 10px',
    marginTop: '6px',
  },
  flagImg: {
    width: '18px',
    height: 'auto',
    borderRadius: '2px',
    flexShrink: 0,
  },
  countryText: {
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
};
