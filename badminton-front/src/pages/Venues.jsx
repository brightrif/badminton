import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import Modal, { FormField, Input, Select, SubmitBtn } from "../components/Modal";

function VenueCard({ v, onEdit, onDelete }) {
  const features = [
    v.has_parking    && "Parking",
    v.has_cafeteria  && "Cafeteria",
    v.has_livestream && "Livestream",
  ].filter(Boolean);

  return (
    <div style={S.card}>
      <div style={S.cardTop}>
        <div>
          <div style={S.name}>{v.name}</div>
          <div style={S.city}>{v.city}{v.country_name ? `, ${v.country_name}` : ""}</div>
        </div>
        <div style={S.courts}>{v.total_courts} court{v.total_courts !== 1 ? "s" : ""}</div>
      </div>
      {features.length > 0 && (
        <div style={S.features}>
          {features.map(f => <span key={f} style={S.feat}>{f}</span>)}
        </div>
      )}
      <div style={S.cardActions}>
        <button style={S.editBtn} onClick={() => onEdit(v)}>Edit</button>
        <button style={S.delBtn}  onClick={() => onDelete(v)}>Delete</button>
      </div>
    </div>
  );
}

function VenueForm({ initial, onSave, onClose }) {
  const { authFetch } = useAuth();
  const { data: countries } = useApi("/api/countries/");
  const [form, setForm] = useState({
    name:           initial?.name          || "",
    address:        initial?.address       || "",
    city:           initial?.city          || "",
    country:        initial?.country       || "",
    total_courts:   initial?.total_courts  || 1,
    has_parking:    initial?.has_parking   || false,
    has_cafeteria:  initial?.has_cafeteria || false,
    has_livestream: initial?.has_livestream|| false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const tog = k => () => setForm(f => ({ ...f, [k]: !f[k] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await authFetch(
        initial ? `/api/venues/${initial.id}/` : "/api/venues/",
        { method: initial ? "PATCH" : "POST", body: JSON.stringify({ ...form, country: Number(form.country), total_courts: Number(form.total_courts) }) }
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <FormField label="Venue name">
          <Input value={form.name} onChange={set("name")} placeholder="e.g. Khalifa Sports City" required />
        </FormField>
        <FormField label="Number of courts">
          <Input type="number" min="1" value={form.total_courts} onChange={set("total_courts")} required />
        </FormField>
      </div>
      <FormField label="Address">
        <Input value={form.address} onChange={set("address")} placeholder="Full street address" required />
      </FormField>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <FormField label="City">
          <Input value={form.city} onChange={set("city")} placeholder="e.g. Manama" required />
        </FormField>
        <FormField label="Country">
          <Select value={form.country} onChange={set("country")} required>
            <option value="">— Select —</option>
            {countryOpts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </FormField>
      </div>
      <FormField label="Facilities">
        <div style={{ display:"flex", gap:16 }}>
          {[["has_parking","Parking"],["has_cafeteria","Cafeteria"],["has_livestream","Livestream"]].map(([k,label]) => (
            <label key={k} style={S.toggle}>
              <input type="checkbox" checked={form[k]} onChange={tog(k)} style={{ accentColor:"#c8ff00" }} />
              {label}
            </label>
          ))}
        </div>
      </FormField>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
        <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
        <SubmitBtn loading={saving}>{initial ? "Save changes" : "Create venue"}</SubmitBtn>
      </div>
    </form>
  );
}

export default function Venues() {
  const { authFetch } = useAuth();
  const { data: venues, loading, refresh } = useApi("/api/venues/");
  const [showCreate, setShowCreate] = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [search,     setSearch]     = useState("");

  const handleDelete = async (v) => {
    if (!confirm(`Delete venue "${v.name}"?`)) return;
    await authFetch(`/api/venues/${v.id}/`, { method:"DELETE" });
    refresh();
  };

  const filtered = (Array.isArray(venues) ? venues : [])
    .filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || (v.city||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={S.page}>
      <style>{CSS}</style>
      <div style={S.topBar}>
        <div>
          <div style={S.title}>Venues</div>
          <div style={S.sub}>{filtered.length} venue{filtered.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
          <input style={S.search} placeholder="Search venue or city…" value={search} onChange={e => setSearch(e.target.value)} />
          <button style={S.createBtn} onClick={() => setShowCreate(true)}>+ Add venue</button>
        </div>
      </div>

      {loading
        ? <div style={S.loading}>Loading…</div>
        : <div style={S.grid}>{filtered.map(v => (
            <VenueCard key={v.id} v={v} onEdit={setEditing} onDelete={handleDelete} />
          ))}</div>
      }

      {(showCreate || editing) && (
        <Modal title={editing ? "Edit venue" : "New venue"} onClose={() => { setShowCreate(false); setEditing(null); }}>
          <VenueForm
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
  grid:      { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:16 },
  card:      { background:"#111", border:"1px solid rgba(255,255,255,0.06)", borderRadius:14, overflow:"hidden" },
  cardTop:   { display:"flex", justifyContent:"space-between", alignItems:"flex-start", padding:"20px 22px 12px" },
  name:      { fontFamily:"'DM Serif Display', serif", fontSize:20, color:"#fff" },
  city:      { fontSize:13, color:"rgba(255,255,255,0.35)", marginTop:4 },
  courts:    { background:"rgba(200,255,0,0.1)", color:"#c8ff00", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:600, whiteSpace:"nowrap" },
  features:  { display:"flex", gap:6, padding:"0 22px 16px", flexWrap:"wrap" },
  feat:      { background:"rgba(255,255,255,0.06)", borderRadius:6, padding:"3px 10px", fontSize:11, color:"rgba(255,255,255,0.4)" },
  cardActions: { display:"flex", borderTop:"1px solid rgba(255,255,255,0.06)" },
  editBtn:   { flex:1, padding:"11px", background:"none", border:"none", color:"rgba(255,255,255,0.5)", fontSize:13, cursor:"pointer", borderRight:"1px solid rgba(255,255,255,0.06)" },
  delBtn:    { flex:1, padding:"11px", background:"none", border:"none", color:"rgba(255,100,100,0.5)", fontSize:13, cursor:"pointer" },
  toggle:    { display:"flex", alignItems:"center", gap:6, fontSize:13, color:"rgba(255,255,255,0.5)", cursor:"pointer" },
  errBox:    { background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.3)", color:"#ff6b6b", borderRadius:8, padding:"10px 14px", fontSize:13 },
  cancelBtn: { background:"none", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"10px 18px", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" },
};
