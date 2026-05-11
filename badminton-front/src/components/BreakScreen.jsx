// src/components/BreakScreen.jsx
//
// Full-screen break display controlled by the director.
//
// Props:
//   tournamentName : string
//   sponsors       : [{ id, name, priority, logo_url }]
//   videoUrl       : string
//   displayMode    : "sponsors" | "video"   ← NEW — director chooses which to show

import { useState, useEffect, useRef } from "react";

function getTier(priority) {
  if (priority >= 80) return "title";
  if (priority >= 40) return "gold";
  return "standard";
}

const BREAK_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600;700&display=swap');

  @keyframes bs-fadeInUp {
    from { opacity: 0; transform: translateY(24px) scale(0.95); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes bs-float {
    0%,100% { transform: translateY(0px); }
    50%     { transform: translateY(-8px); }
  }
  @keyframes bs-glowTitle {
    0%,100% { box-shadow: 0 0 24px rgba(200,255,0,0.2), 0 0 60px rgba(200,255,0,0.06); }
    50%     { box-shadow: 0 0 48px rgba(200,255,0,0.45), 0 0 100px rgba(200,255,0,0.15); }
  }
  @keyframes bs-titlePulse {
    0%,100% { opacity:1; letter-spacing:5px; }
    50%     { opacity:0.88; letter-spacing:7px; }
  }
  @keyframes bs-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
  @keyframes bs-videoFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes bs-marqueeV {
    0%   { transform: translateY(0); }
    100% { transform: translateY(-50%); }
  }
  @keyframes bs-dividerGlow {
    0%,100% { opacity: 0.3; }
    50%     { opacity: 0.8; }
  }
  .bs-card:hover {
    transform: scale(1.05) translateY(-4px) !important;
  }
`;

// ── Sponsor card ──────────────────────────────────────────────────────────────
function SponsorCard({ sponsor, index, tier }) {
  const [imgErr, setImgErr] = useState(false);
  const sizes = { title: 130, gold: 88, standard: 60 };
  const paddings = {
    title: "28px 36px",
    gold: "18px 24px",
    standard: "12px 18px",
  };
  const imgSize = sizes[tier] ?? 60;

  return (
    <div
      className="bs-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: paddings[tier],
        borderRadius: tier === "title" ? 22 : 14,
        border:
          tier === "title"
            ? "1px solid rgba(200,255,0,0.35)"
            : tier === "gold"
              ? "1px solid rgba(255,200,50,0.2)"
              : "1px solid rgba(255,255,255,0.08)",
        background:
          tier === "title"
            ? "rgba(200,255,0,0.07)"
            : tier === "gold"
              ? "rgba(255,200,50,0.05)"
              : "rgba(255,255,255,0.04)",
        backdropFilter: "blur(12px)",
        transition: "transform 0.3s ease, box-shadow 0.3s ease",
        animation:
          tier === "title"
            ? `bs-fadeInUp 0.8s ease 0.1s both, bs-glowTitle 3.5s ease-in-out infinite`
            : `bs-fadeInUp 0.6s ease ${index * 0.1}s both, bs-float ${4 + (index % 3) * 0.8}s ease-in-out ${index * 0.3}s infinite`,
      }}
    >
      {sponsor.logo_url && !imgErr ? (
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          onError={() => setImgErr(true)}
          style={{
            width: imgSize,
            height: imgSize,
            objectFit: "contain",
            filter: "brightness(1.1) drop-shadow(0 2px 8px rgba(0,0,0,0.4))",
          }}
        />
      ) : (
        <div
          style={{
            width: imgSize,
            height: imgSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            background: "rgba(200,255,0,0.08)",
            fontFamily: "'Bebas Neue',cursive",
            fontSize: tier === "title" ? 26 : 16,
            color: "#c8ff00",
            letterSpacing: 2,
            textAlign: "center",
            padding: "0 6px",
          }}
        >
          {sponsor.name}
        </div>
      )}
      <span
        style={{
          fontFamily: "'DM Sans',sans-serif",
          fontSize: tier === "title" ? 13 : tier === "gold" ? 11 : 10,
          fontWeight: 700,
          color:
            tier === "title"
              ? "#c8ff00"
              : tier === "gold"
                ? "rgba(255,200,50,0.7)"
                : "rgba(255,255,255,0.35)",
          letterSpacing: 2,
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {sponsor.name}
      </span>
    </div>
  );
}

function VerticalMarquee({ sponsors }) {
  const doubled = [...sponsors, ...sponsors];
  return (
    <div
      style={{
        overflow: "hidden",
        maxHeight: "55vh",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          zIndex: 2,
          background: "linear-gradient(to bottom,#080d00,transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 40,
          zIndex: 2,
          background: "linear-gradient(to top,#080d00,transparent)",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          animation: `bs-marqueeV ${sponsors.length * 2.5}s linear infinite`,
          width: "100%",
          alignItems: "center",
        }}
      >
        {doubled.map((s, i) => (
          <SponsorCard
            key={`${s.id}-${i}`}
            sponsor={s}
            index={i}
            tier="standard"
          />
        ))}
      </div>
    </div>
  );
}

function VDivider() {
  return (
    <div
      style={{
        width: 1,
        alignSelf: "stretch",
        background:
          "linear-gradient(to bottom,transparent,rgba(200,255,0,0.3),transparent)",
        flexShrink: 0,
        animation: "bs-dividerGlow 3s ease-in-out infinite",
        margin: "32px 0",
      }}
    />
  );
}

function ColHeader({ label, color = "rgba(255,255,255,0.2)" }) {
  return (
    <div
      style={{
        fontSize: "clamp(8px,0.7vw,10px)",
        fontFamily: "'DM Sans',sans-serif",
        fontWeight: 800,
        letterSpacing: 5,
        color,
        textTransform: "uppercase",
        marginBottom: 20,
        textAlign: "center",
      }}
    >
      {label}
    </div>
  );
}

// ── Shared dark background + grid + orbs wrapper ──────────────────────────────
function BreakBg({ children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background:
          "linear-gradient(135deg,#050d00 0%,#0a1500 45%,#030300 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 9999,
      }}
    >
      <style>{BREAK_CSS}</style>
      {/* Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg,transparent,transparent 59px,rgba(200,255,0,0.018) 60px),repeating-linear-gradient(90deg,transparent,transparent 59px,rgba(200,255,0,0.018) 60px)",
          pointerEvents: "none",
        }}
      />
      {/* Orbs */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "8%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(200,255,0,0.05) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          right: "8%",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle,rgba(0,180,255,0.04) 0%,transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}

// ── Tournament name header (shared) ──────────────────────────────────────────
function TournamentHeader({ tournamentName }) {
  return (
    <div
      style={{
        flexShrink: 0,
        zIndex: 10,
        paddingTop: "clamp(24px,4vh,52px)",
        paddingBottom: "clamp(12px,2vh,20px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: "clamp(9px,0.85vw,12px)",
          fontFamily: "'DM Sans',sans-serif",
          fontWeight: 700,
          letterSpacing: 7,
          color: "rgba(200,255,0,0.45)",
          textTransform: "uppercase",
        }}
      >
        BREAK TIME · BROUGHT TO YOU BY
      </div>
      <div
        style={{
          fontFamily: "'Bebas Neue',cursive",
          fontSize: "clamp(38px,6.5vw,90px)",
          letterSpacing: 5,
          color: "#fff",
          lineHeight: 1,
          animation: "bs-titlePulse 5s ease-in-out infinite",
          textAlign: "center",
          padding: "0 clamp(16px,4vw,80px)",
        }}
      >
        {tournamentName || "TOURNAMENT BREAK"}
      </div>
      <div
        style={{
          width: "clamp(80px,22vw,320px)",
          height: 2,
          borderRadius: 2,
          background: "linear-gradient(90deg,transparent,#c8ff00,transparent)",
          backgroundSize: "200% 100%",
          animation: "bs-shimmer 2.4s linear infinite",
        }}
      />
    </div>
  );
}

// ── Footer (shared) ───────────────────────────────────────────────────────────
function BreakFooter() {
  return (
    <div
      style={{
        flexShrink: 0,
        zIndex: 10,
        paddingBottom: "clamp(12px,2vh,24px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: 0.35,
      }}
    >
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#c8ff00",
          animation: "bs-glowTitle 1.6s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 5,
          color: "#fff",
          textTransform: "uppercase",
        }}
      >
        INTERMISSION
      </span>
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#c8ff00",
          animation: "bs-glowTitle 1.6s ease-in-out 0.8s infinite",
        }}
      />
    </div>
  );
}

// ── VIDEO MODE ────────────────────────────────────────────────────────────────
function VideoBreakScreen({ tournamentName, sponsors, videoUrl }) {
  const videoRef = useRef(null);
  const titleSponsors = sponsors.filter((s) => getTier(s.priority) === "title");

  useEffect(() => {
    if (videoRef.current) videoRef.current.play().catch(() => {});
  }, [videoUrl]);

  return (
    <BreakBg>
      <div
        style={{
          flex: 1,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          animation: "bs-videoFadeIn 0.5s ease",
        }}
      >
        {videoUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              playsInline
              loop
              style={{
                maxWidth: "90vw",
                maxHeight: "82vh",
                borderRadius: 16,
                boxShadow: "0 0 80px rgba(0,0,0,0.9)",
              }}
            />
            {/* Tournament name watermark — top centre */}
            <div
              style={{
                position: "absolute",
                top: 24,
                left: "50%",
                transform: "translateX(-50%)",
                fontFamily: "'Bebas Neue',cursive",
                fontSize: "clamp(18px,2.5vw,36px)",
                letterSpacing: 4,
                color: "rgba(255,255,255,0.55)",
                pointerEvents: "none",
                textAlign: "center",
                whiteSpace: "nowrap",
              }}
            >
              {tournamentName}
            </div>
            {/* Title sponsor watermark — bottom */}
            {titleSponsors.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  bottom: 28,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "rgba(0,0,0,0.72)",
                  borderRadius: 30,
                  padding: "8px 24px",
                  backdropFilter: "blur(8px)",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.4)",
                    letterSpacing: 3,
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 700,
                  }}
                >
                  PRESENTED BY
                </span>
                {titleSponsors[0].logo_url && (
                  <img
                    src={titleSponsors[0].logo_url}
                    alt={titleSponsors[0].name}
                    style={{ height: 28, objectFit: "contain" }}
                  />
                )}
                <span
                  style={{
                    fontSize: 13,
                    color: "#c8ff00",
                    fontFamily: "'DM Sans',sans-serif",
                    fontWeight: 700,
                  }}
                >
                  {titleSponsors[0].name}
                </span>
              </div>
            )}
          </>
        ) : (
          /* No video uploaded yet */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ fontSize: 64, opacity: 0.2 }}>🎬</div>
            <div
              style={{
                fontFamily: "'Bebas Neue',cursive",
                fontSize: "clamp(24px,3vw,42px)",
                color: "rgba(255,255,255,0.15)",
                letterSpacing: 4,
              }}
            >
              NO VIDEO UPLOADED
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.2)",
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Upload a video from the Director Dashboard
            </div>
          </div>
        )}
      </div>
      <BreakFooter />
    </BreakBg>
  );
}

// ── SPONSORS MODE ─────────────────────────────────────────────────────────────
function SponsorsBreakScreen({ tournamentName, sponsors }) {
  const titleSponsors = sponsors.filter((s) => getTier(s.priority) === "title");
  const goldSponsors = sponsors.filter((s) => getTier(s.priority) === "gold");
  const standardSponsors = sponsors.filter(
    (s) => getTier(s.priority) === "standard",
  );

  return (
    <BreakBg>
      <TournamentHeader tournamentName={tournamentName} />

      {/* 3-column grid */}
      <div
        style={{
          flex: 1,
          zIndex: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1px 1.2fr 1px 1fr",
          alignItems: "center",
          padding: "0 clamp(24px,5vw,80px)",
          minHeight: 0,
          gap: "0 clamp(16px,2vw,40px)",
        }}
      >
        {/* LEFT — Gold */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingBottom: "clamp(16px,3vh,40px)",
          }}
        >
          {goldSponsors.length > 0 && (
            <>
              <ColHeader label="Gold Sponsors" color="rgba(255,200,50,0.55)" />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  width: "100%",
                }}
              >
                {goldSponsors.map((s, i) => (
                  <SponsorCard key={s.id} sponsor={s} index={i} tier="gold" />
                ))}
              </div>
            </>
          )}
        </div>

        <VDivider />

        {/* CENTRE — Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingBottom: "clamp(16px,3vh,40px)",
          }}
        >
          {titleSponsors.length > 0 ? (
            <>
              <ColHeader label="Title Sponsor" color="rgba(200,255,0,0.6)" />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 24,
                }}
              >
                {titleSponsors.map((s, i) => (
                  <SponsorCard key={s.id} sponsor={s} index={i} tier="title" />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                fontFamily: "'Bebas Neue',cursive",
                fontSize: "clamp(28px,4vw,60px)",
                color: "rgba(255,255,255,0.05)",
                letterSpacing: 6,
              }}
            >
              BREAK
            </div>
          )}
        </div>

        <VDivider />

        {/* RIGHT — Standard */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            paddingBottom: "clamp(16px,3vh,40px)",
          }}
        >
          {standardSponsors.length > 0 && (
            <>
              <ColHeader label="Supported By" color="rgba(255,255,255,0.3)" />
              {standardSponsors.length > 4 ? (
                <VerticalMarquee sponsors={standardSponsors} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  {standardSponsors.map((s, i) => (
                    <SponsorCard
                      key={s.id}
                      sponsor={s}
                      index={i}
                      tier="standard"
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BreakFooter />
    </BreakBg>
  );
}

// ── Main export — routes to the right mode ────────────────────────────────────
export default function BreakScreen({
  tournamentName,
  sponsors = [],
  videoUrl = "",
  displayMode = "sponsors",
}) {
  if (displayMode === "video") {
    return (
      <VideoBreakScreen
        tournamentName={tournamentName}
        sponsors={sponsors}
        videoUrl={videoUrl}
      />
    );
  }
  return (
    <SponsorsBreakScreen tournamentName={tournamentName} sponsors={sponsors} />
  );
}
