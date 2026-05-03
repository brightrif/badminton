export default function Modal({ title, onClose, children, width = 560 }) {
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.panel, width }}>
        <div style={S.header}>
          <div style={S.title}>{title}</div>
          <button style={S.close} onClick={onClose}>✕</button>
        </div>
        <div style={S.body}>{children}</div>
      </div>
    </div>
  );
}

export function FormField({ label, children, hint }) {
  return (
    <div style={FS.field}>
      <label style={FS.label}>{label}</label>
      {children}
      {hint && <div style={FS.hint}>{hint}</div>}
    </div>
  );
}

export function Input({ style, ...props }) {
  return <input style={{ ...FS.input, ...style }} {...props} />;
}

export function Select({ style, children, ...props }) {
  return (
    <select style={{ ...FS.input, ...style }} {...props}>
      {children}
    </select>
  );
}

export function SubmitBtn({ loading, children }) {
  return (
    <button type="submit" style={{ ...FS.submit, opacity: loading ? 0.6 : 1 }} disabled={loading}>
      {loading ? "Saving…" : children}
    </button>
  );
}

const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  panel: {
    background: "#111", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 18, overflow: "hidden", maxHeight: "90vh",
    display: "flex", flexDirection: "column",
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "22px 28px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  title: { fontFamily: "'DM Serif Display', serif", fontSize: 22, color: "#fff" },
  close: {
    background: "none", border: "none", color: "rgba(255,255,255,0.4)",
    fontSize: 18, cursor: "pointer", padding: 4,
  },
  body: { padding: "28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 },
};

const FS = {
  field:  { display: "flex", flexDirection: "column", gap: 6 },
  label:  { fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "1px", textTransform: "uppercase" },
  hint:   { fontSize: 11, color: "rgba(255,255,255,0.25)" },
  input: {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, padding: "11px 14px", color: "#fff", fontSize: 14,
    width: "100%",
  },
  submit: {
    background: "#c8ff00", color: "#0a0a0a", border: "none", borderRadius: 10,
    padding: "13px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer",
    alignSelf: "flex-end", marginTop: 8,
  },
};
