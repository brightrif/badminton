import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import Modal, { FormField, Input, Select, SubmitBtn } from "../components/Modal";

const API_BASE = "http://127.0.0.1:8000";

function PlayerCard({ p, onEdit, onDelete }) {
  const photo = p.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1a2d00&color=c8ff00&size=80`;
  return (
    <div style={S.card}>
      <div style={S.avatar}>
        <img src={photo} alt={p.name} style={S.photo} onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=1a2d00&color=c8ff00&size=80`; }} />
      </div>
      <div style={S.info}>
        <div style={S.name}>{p.name}</div>
        <div style={S.country}>
          {p.country_code && <span style={S.code}>{p.country_code}</span>}
          {p.country_name || ""}
        </div>
      </div>
      <div style={S.actions}>
        <button style={S.editBtn} onClick={() => onEdit(p)}>Edit</button>
        <button style={S.delBtn}  onClick={() => onDelete(p)}>✕</button>
      </div>
    </div>
  );
}

function PlayerForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: countries } = useApi("/api/countries/");
  const [name,    setName]    = useState(initial?.name || "");
  const [country, setCountry] = useState(initial?.country || "");
  const [photo,   setPhoto]   = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("country", country);
      if (photo) fd.append("photo", photo);

      const res = await authFetch(
        initial ? `/api/players/${initial.id}/` : "/api/players/",
        { method: initial ? "PATCH" : "POST", body: fd, headers:{} }
      );
      if (!res.ok) { const d = await res.json(); throw new Error(JSON.stringify(d)); }
      onSave();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const countryOpts = Array.isArray(countries) ? countries : [];

  return (
    <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {error && <div style={S.errBox}>{error}</div>}
      <FormField label="Full name">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Viktor Axelsen" required />
      </FormField>
      <FormField label="Country">
        <Select value={country} onChange={e => setCountry(e.target.value)} required>
          <option value="">— Select country —</option>
          {countryOpts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
        </Select>
      </FormField>
      <FormField label="Player photo" hint="Optional — JPEG or PNG, shown on big screen">
        <input
          type="file" accept="image/*"
          onChange={e => setPhoto(e.target.files[0])}
          style={{ ...S.fileInput, color:"rgba(255,255,255,0.5)" }}
        />
        {initial?.photo_url && !photo && (
          <div style={S.currentPhoto}>
            <img src={initial.photo_url} alt="Current" style={{ height:40, borderRadius:6 }} />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>Current photo</span>
          </div>
        )}
      </FormField>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
        <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
        <SubmitBtn loading={saving}>{initial ? "Save changes" : "Add player"}</SubmitBtn>
      </div>
    </form>
  );
}

export default function Players() {
  const { authFetch } = useAuth();
  const { data: players, loading, refresh } = useApi("/api/players/");
  const [search,     setSearch]     = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState(null);

  const handleDelete = async (p) => {
    if (!confirm(`Delete player "${p.name}"?`)) return;
    await authFetch(`/api/players/${p.id}/`, { method:"DELETE" });
    refresh();
  };

  const filtered = (Array.isArray(players) ? players : [])
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.country_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.topBar}>
        <div>
          <div style={S.title}>Players</div>
          <div style={S.sub}>{filtered.length} registered player{filtered.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <input style={S.search} placeholder="Search name or country…" value={search} onChange={e => setSearch(e.target.value)} />
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>+ Add player</button>
        </div>
      </div>

      {loading
        ? <div style={S.loading}>Loading…</div>
        : <div style={S.grid}>{filtered.map(p => (
            <PlayerCard key={p.id} p={p} onEdit={setEditing} onDelete={handleDelete} />
          ))}</div>
      }

      {(showCreate || editing) && (
        <Modal title={editing ? "Edit player" : "Add player"} onClose={() => { setShowCreate(false); setEditing(null); }}>
          <PlayerForm
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
  search:    { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:13, width:220 },
  createBtn: { background:"#c8ff00", color:"#0a0a0a", border:"none", borderRadius:10, padding:"11px 20px", fontSize:13, fontWeight:700, cursor:"pointer" },
  loading:   { color:"rgba(255,255,255,0.3)", fontSize:14 },
  grid:      { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))", gap:14 },
  card: {
    background:"#111", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12,
    display:"flex", alignItems:"center", gap:14, padding:"14px 16px",
  },
  avatar: { flexShrink:0 },
  photo:  { width:46, height:46, borderRadius:"50%", objectFit:"cover", background:"#1a2d00" },
  info:   { flex:1, minWidth:0 },
  name:   { fontSize:14, color:"#fff", fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  country:{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:2, display:"flex", alignItems:"center", gap:6 },
  code:   { background:"rgba(200,255,0,0.1)", color:"#c8ff00", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700, letterSpacing:"1px" },
  actions:{ display:"flex", gap:6, flexShrink:0 },
  editBtn:{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:6, padding:"5px 10px", color:"rgba(255,255,255,0.5)", fontSize:12, cursor:"pointer" },
  delBtn: { background:"none", border:"none", color:"rgba(255,100,100,0.4)", fontSize:14, cursor:"pointer", padding:"4px" },
  errBox: { background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.3)", color:"#ff6b6b", borderRadius:8, padding:"10px 14px", fontSize:13 },
  fileInput: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 14px", fontSize:13, width:"100%" },
  currentPhoto: { display:"flex", alignItems:"center", gap:10, marginTop:8 },
  cancelBtn: { background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 18px", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" },
};
