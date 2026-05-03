import { useState } from "react";
import { useDirectorApi as useApi } from "../../hooks/useDirectorApi";
import { useAuth } from "../../context/AuthContext";
import Modal, { FormField, Input, SubmitBtn } from "../../components/Modal";

function TournamentCard({ t, onEdit, onDelete }) {
  const start = new Date(t.start_date).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
  const end   = new Date(t.end_date).toLocaleDateString("en-GB",   { day:"numeric", month:"short", year:"numeric" });
  const now   = new Date();
  const s = new Date(t.start_date), e = new Date(t.end_date);
  const status = now < s ? "Upcoming" : now > e ? "Completed" : "Live";
  const clr = { Live:"#c8ff00", Upcoming:"#4af", Completed:"#888" }[status];

  return (
    <div style={S.card}>
      <div style={{ ...S.statusBar, background: clr }} />
      <div style={S.cardBody}>
        <div style={S.cardHead}>
          <div style={S.cardName}>{t.name}</div>
          <span style={{ ...S.pill, background: `${clr}22`, color: clr }}>{status}</span>
        </div>
        <div style={S.dates}>📅 {start} — {end}</div>
        {t.venues_detail?.length > 0 && (
          <div style={S.venues}>
            {t.venues_detail.map(v => (
              <span key={v.id} style={S.venueTag}>{v.venue_name}</span>
            ))}
          </div>
        )}
        <div style={S.sponsors}>
          {(t.sponsors?.length ?? 0)} sponsor{t.sponsors?.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div style={S.cardActions}>
        <button style={S.editBtn} onClick={() => onEdit(t)}>Edit</button>
        <button style={S.delBtn}  onClick={() => onDelete(t)}>Delete</button>
      </div>
    </div>
  );
}

function TournamentForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    name:       initial?.name       || "",
    start_date: initial?.start_date || "",
    end_date:   initial?.end_date   || "",
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await authFetch(
        initial ? `/api/tournaments/${initial.id}/` : "/api/tournaments/",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify(form) }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(JSON.stringify(d)); }
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {error && <div style={S.errBox}>{error}</div>}
      <FormField label="Tournament name">
        <Input value={form.name} onChange={set("name")} placeholder="e.g. Bahrain International 2025" required />
      </FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <FormField label="Start date">
          <Input type="date" value={form.start_date} onChange={set("start_date")} required />
        </FormField>
        <FormField label="End date">
          <Input type="date" value={form.end_date} onChange={set("end_date")} required />
        </FormField>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
        <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
        <SubmitBtn loading={saving}>{initial ? "Save changes" : "Create tournament"}</SubmitBtn>
      </div>
    </form>
  );
}

export default function Tournaments() {
  const { authFetch } = useAuth();
  const { data: tournaments, loading, refresh } = useApi("/api/tournaments/");
  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [search,     setSearch]     = useState("");

  const handleDelete = async (t) => {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    await authFetch(`/api/tournaments/${t.id}/`, { method: "DELETE" });
    refresh();
  };

  const filtered = (Array.isArray(tournaments) ? tournaments : [])
    .filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.topBar}>
        <div>
          <div style={S.title}>Tournaments</div>
          <div style={S.sub}>{filtered.length} tournament{filtered.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <input style={S.search} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>+ New tournament</button>
        </div>
      </div>

      {loading
        ? <div style={S.loading}>Loading…</div>
        : <div style={S.grid}>{filtered.map(t => (
            <TournamentCard key={t.id} t={t} onEdit={setEditing} onDelete={handleDelete} />
          ))}</div>
      }

      {(showCreate || editing) && (
        <Modal
          title={editing ? "Edit tournament" : "New tournament"}
          onClose={() => { setShowCreate(false); setEditing(null); }}
        >
          <TournamentForm
            initial={editing}
            onSave={() => { setShowCreate(false); setEditing(null); refresh(); }}
            onClose={() => { setShowCreate(false); setEditing(null); }}
          />
        </Modal>
      )}
    </div>
  );
}

const CSS = `@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const S = {
  page:      { display:"flex", flexDirection:"column", gap:28 },
  topBar:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  title:     { fontFamily:"'DM Serif Display', serif", fontSize:34, color:"#fff" },
  sub:       { fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:6 },
  search:    { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:13, width:200 },
  createBtn: { background:"#c8ff00", color:"#0a0a0a", border:"none", borderRadius:10, padding:"11px 20px", fontSize:13, fontWeight:700, cursor:"pointer" },
  loading:   { color:"rgba(255,255,255,0.3)", fontSize:14 },
  grid:      { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:18 },
  card:      { background:"#111", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden", display:"flex", flexDirection:"column" },
  statusBar: { height:3 },
  cardBody:  { padding:"20px 22px", flex:1, display:"flex", flexDirection:"column", gap:10 },
  cardHead:  { display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 },
  cardName:  { fontFamily:"'DM Serif Display', serif", fontSize:20, color:"#fff" },
  pill:      { borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:600, flexShrink:0 },
  dates:     { fontSize:13, color:"rgba(255,255,255,0.4)" },
  venues:    { display:"flex", flexWrap:"wrap", gap:6 },
  venueTag:  { background:"rgba(255,255,255,0.06)", borderRadius:6, padding:"3px 10px", fontSize:11, color:"rgba(255,255,255,0.5)" },
  sponsors:  { fontSize:11, color:"rgba(255,255,255,0.25)" },
  cardActions: { display:"flex", gap:0, borderTop:"1px solid rgba(255,255,255,0.06)" },
  editBtn: { flex:1, padding:"11px", background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer", borderRight:"1px solid rgba(255,255,255,0.06)" },
  delBtn:  { flex:1, padding:"11px", background:"none", border:"none", color:"rgba(255,100,100,0.5)", fontSize:13, cursor:"pointer" },
  errBox:  { background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.3)", color:"#ff6b6b", borderRadius:8, padding:"10px 14px", fontSize:13 },
  cancelBtn: { background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 18px", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" },
};
