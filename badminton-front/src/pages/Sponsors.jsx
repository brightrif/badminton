import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import Modal, { FormField, Input, Select, SubmitBtn } from "../components/Modal";

function SponsorCard({ s, onEdit, onDelete }) {
  return (
    <div style={S.card}>
      <div style={S.logoWrap}>
        {s.logo_url
          ? <img src={s.logo_url} alt={s.name} style={S.logo} />
          : <div style={S.logoPlaceholder}>{s.name[0]}</div>
        }
      </div>
      <div style={S.info}>
        <div style={S.name}>{s.name}</div>
        <div style={S.meta}>{s.tournament_name}</div>
        <div style={S.priority}>Priority: <strong style={{ color:"#c8ff00" }}>{s.priority}</strong></div>
      </div>
      <div style={S.actions}>
        <button style={S.editBtn} onClick={() => onEdit(s)}>Edit</button>
        <button style={S.delBtn}  onClick={() => onDelete(s)}>✕</button>
      </div>
    </div>
  );
}

function SponsorForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: tournaments } = useApi("/api/tournaments/");
  const [name,       setName]       = useState(initial?.name        || "");
  const [tournament, setTournament] = useState(initial?.tournament   || "");
  const [priority,   setPriority]   = useState(initial?.priority ?? 0);
  const [logo,       setLogo]       = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("priority", priority);
      if (tournament) fd.append("tournament", tournament);
      if (logo) fd.append("logo", logo);

      const res = await authFetch(
        initial ? `/api/sponsors/${initial.id}/` : "/api/sponsors/",
        { method: initial ? "PATCH" : "POST", body: fd, headers:{} }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(JSON.stringify(d)); }
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const tournOpts = Array.isArray(tournaments) ? tournaments : [];

  return (
    <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {error && <div style={S.errBox}>{error}</div>}
      <FormField label="Sponsor name">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Yonex" required />
      </FormField>
      <FormField label="Tournament" hint="Leave blank for a global sponsor">
        <Select value={tournament} onChange={e => setTournament(e.target.value)}>
          <option value="">— Global sponsor —</option>
          {tournOpts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </FormField>
      <FormField label="Display priority" hint="Higher number = shown first in carousel">
        <Input type="number" min="0" max="100" value={priority} onChange={e => setPriority(e.target.value)} />
      </FormField>
      <FormField label="Logo image" hint="PNG or SVG recommended — shown on big screen">
        <input
          type="file" accept="image/*"
          onChange={e => setLogo(e.target.files[0])}
          style={S.fileInput}
        />
        {initial?.logo_url && !logo && (
          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
            <img src={initial.logo_url} alt="Current" style={{ height:36, borderRadius:6, background:"#fff", padding:4 }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>Current logo</span>
          </div>
        )}
      </FormField>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
        <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
        <SubmitBtn loading={saving}>{initial ? "Save changes" : "Add sponsor"}</SubmitBtn>
      </div>
    </form>
  );
}

export default function Sponsors() {
  const { authFetch } = useAuth();
  const { data: sponsors, loading, refresh } = useApi("/api/sponsors/");
  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [search,     setSearch]     = useState("");

  const handleDelete = async (s) => {
    if (!confirm(`Delete sponsor "${s.name}"?`)) return;
    await authFetch(`/api/sponsors/${s.id}/`, { method:"DELETE" });
    refresh();
  };

  const filtered = (Array.isArray(sponsors) ? sponsors : [])
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.tournament_name||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.priority - a.priority);

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.topBar}>
        <div>
          <div style={S.title}>Sponsors</div>
          <div style={S.sub}>Manage sponsor logos and carousel order</div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <input style={S.search} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>+ Add sponsor</button>
        </div>
      </div>

      <div style={S.hint}>
        ★ Sponsors are sorted by priority (highest first) in the big screen carousel.
      </div>

      {loading
        ? <div style={S.loading}>Loading…</div>
        : <div style={S.grid}>{filtered.map(s => (
            <SponsorCard key={s.id} s={s} onEdit={setEditing} onDelete={handleDelete} />
          ))}</div>
      }

      {(showCreate || editing) && (
        <Modal title={editing ? "Edit sponsor" : "Add sponsor"} onClose={() => { setShowCreate(false); setEditing(null); }}>
          <SponsorForm
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
  page:      { display:"flex", flexDirection:"column", gap:24 },
  topBar:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  title:     { fontFamily:"'DM Serif Display', serif", fontSize:34, color:"#fff" },
  sub:       { fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:6 },
  hint:      { fontSize:12, color:"rgba(200,255,0,0.4)", background:"rgba(200,255,0,0.05)", border:"1px solid rgba(200,255,0,0.1)", borderRadius:8, padding:"10px 16px" },
  search:    { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:13, width:200 },
  createBtn: { background:"#c8ff00", color:"#0a0a0a", border:"none", borderRadius:10, padding:"11px 20px", fontSize:13, fontWeight:700, cursor:"pointer" },
  loading:   { color:"rgba(255,255,255,0.3)", fontSize:14 },
  grid:      { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 },
  card:      { background:"#111", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, display:"flex", alignItems:"center", gap:14, padding:"16px 18px" },
  logoWrap:  { flexShrink:0 },
  logo:      { width:52, height:52, objectFit:"contain", borderRadius:8, background:"#fff", padding:4 },
  logoPlaceholder: { width:52, height:52, borderRadius:8, background:"rgba(200,255,0,0.1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#c8ff00", fontSize:22, fontWeight:700 },
  info:      { flex:1, minWidth:0 },
  name:      { fontSize:14, color:"#fff", fontWeight:500 },
  meta:      { fontSize:12, color:"rgba(255,255,255,0.3)", marginTop:2 },
  priority:  { fontSize:12, color:"rgba(255,255,255,0.3)", marginTop:4 },
  actions:   { display:"flex", gap:6, flexShrink:0 },
  editBtn:   { background:"rgba(255,255,255,0.06)", border:"none", borderRadius:6, padding:"5px 10px", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer" },
  delBtn:    { background:"none", border:"none", color:"rgba(255,100,100,0.4)", fontSize:14, cursor:"pointer", padding:"4px" },
  errBox:    { background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.3)", color:"#ff6b6b", borderRadius:8, padding:"10px 14px", fontSize:13 },
  fileInput: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", fontSize:13, width:"100%", color:"rgba(255,255,255,0.5)" },
  cancelBtn: { background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 18px", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" },
};
