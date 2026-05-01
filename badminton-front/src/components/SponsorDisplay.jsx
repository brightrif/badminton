// src/components/SponsorDisplay.jsx
// Fixed: removed non-standard h-15 Tailwind class, uses inline styles throughout.

import React from 'react';

export default function SponsorDisplay({ sponsor }) {
  if (!sponsor) return null;

  const logoSrc = sponsor.logo_url || sponsor.logo;

  return (
    <div style={S.wrap}>
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={sponsor.name || 'Sponsor'}
          style={S.logo}
          onError={e => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
      ) : null}
      {/* Text fallback — always rendered, hidden by default if image loads */}
      <div style={{
        ...S.textFallback,
        display: logoSrc ? 'none' : 'flex',
      }}>
        {sponsor.name || 'Sponsor'}
      </div>
    </div>
  );
}

const S = {
  wrap: {
    background: 'rgba(255,255,255,0.92)',
    borderRadius: '10px',
    padding: '8px 16px',
    height: '52px',
    minWidth: '120px',
    maxWidth: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    maxHeight: '36px',
    maxWidth: '140px',
    objectFit: 'contain',
    display: 'block',
  },
  textFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '13px',
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: '0.5px',
    textAlign: 'center',
  },
};
