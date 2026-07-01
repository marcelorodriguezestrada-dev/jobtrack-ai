import { useState, useEffect } from "react";

export default function ProfileModal({ token, onClose }) {
  const API = import.meta.env.VITE_API_URL || "https://jobtrack-ai-backend.onrender.com";

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Editable fields
  const [name, setName] = useState("");
  const [desiredRole, setDesiredRole] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [skills, setSkills] = useState("");
  const [keywords, setKeywords] = useState("");
  const [locations, setLocations] = useState("");

  useEffect(() => {
    fetch(`${API}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(p => {
        setProfile(p);
        setName(p.name || "");
        setDesiredRole(p.desired_role || "");
        setExperienceYears(p.experience_years || "");
        setSkills((p.skills || []).join(", "));
        setKeywords((p.keywords || []).join(", "));
        setLocations((p.preferred_locations || []).join(", "));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token, API]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          desired_role: desiredRole,
          experience_years: Number(experienceYears),
          skills: skills.split(",").map(s => s.trim()).filter(Boolean),
          keywords: keywords.split(",").map(s => s.trim()).filter(Boolean),
          preferred_locations: locations.split(",").map(s => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <div style={s.title}>⚙ Mi Perfil</div>
            <div style={s.subtitle}>El scraper usa estos datos para buscar y rankear ofertas</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={s.loading}>Cargando perfil…</div>
        ) : (
          <div style={s.body}>
            <div style={s.grid}>
              <div style={s.field}>
                <label style={s.label}>Nombre</label>
                <input
                  style={s.input}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Rol deseado</label>
                <input
                  style={s.input}
                  value={desiredRole}
                  onChange={e => setDesiredRole(e.target.value)}
                  placeholder="ej. Senior Data Engineer"
                />
              </div>

              <div style={s.field}>
                <label style={s.label}>Años de experiencia</label>
                <input
                  style={s.input}
                  type="number"
                  value={experienceYears}
                  onChange={e => setExperienceYears(e.target.value)}
                  placeholder="ej. 10"
                  min="0"
                  max="50"
                />
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Skills <span style={s.hint}>(separadas por coma)</span></label>
              <input
                style={s.input}
                value={skills}
                onChange={e => setSkills(e.target.value)}
                placeholder="Python, SQL, BigQuery, Airflow, AWS, dbt"
              />
              <div style={s.tagRow}>
                {skills.split(",").map(s => s.trim()).filter(Boolean).map((sk, i) => (
                  <span key={i} style={pill}>{sk}</span>
                ))}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>
                Keywords de búsqueda
                <span style={s.hint}> — el scraper busca estas frases en los portales</span>
              </label>
              <input
                style={s.input}
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                placeholder="data engineer, data architect, analytics engineer"
              />
              <div style={s.tagRow}>
                {keywords.split(",").map(k => k.trim()).filter(Boolean).map((kw, i) => (
                  <span key={i} style={{ ...pill, borderColor: "#00ff8844", color: "#00ff88" }}>{kw}</span>
                ))}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>
                Ubicaciones preferidas
                <span style={s.hint}> (separadas por coma)</span>
              </label>
              <input
                style={s.input}
                value={locations}
                onChange={e => setLocations(e.target.value)}
                placeholder="Argentina, Remote, Remoto"
              />
            </div>

            {error && <div style={s.error}>⚠ {error}</div>}
          </div>
        )}

        <div style={s.footer}>
          <div style={s.footerHint}>
            Después de guardar, hacé un nuevo scraping para aplicar los cambios
          </div>
          <button
            style={{ ...s.btnSave, ...(saving ? s.btnDisabled : {}), ...(saved ? s.btnSaved : {}) }}
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saved ? "✓ Guardado" : saving ? "Guardando…" : "Guardar perfil"}
          </button>
        </div>
      </div>
    </div>
  );
}

const pill = {
  display: "inline-block",
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  color: "#888",
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: 12,
  margin: "4px 4px 0 0",
};

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  },
  modal: {
    background: "#111", border: "1px solid #222", borderRadius: 14,
    width: "100%", maxWidth: 600, maxHeight: "85vh",
    overflow: "hidden", display: "flex", flexDirection: "column",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "20px 24px 16px", borderBottom: "1px solid #1a1a1a",
  },
  title: { color: "#fff", fontWeight: 700, fontSize: 16 },
  subtitle: { color: "#444", fontSize: 12, marginTop: 3 },
  closeBtn: {
    background: "transparent", border: "none", color: "#444",
    fontSize: 18, cursor: "pointer",
  },
  loading: { padding: 48, textAlign: "center", color: "#444", fontSize: 14 },
  body: { padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { color: "#666", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 },
  hint: { color: "#333", fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: 11 },
  input: {
    background: "#0d0d0d", border: "1px solid #222", borderRadius: 8,
    color: "#ccc", fontSize: 14, padding: "10px 12px", outline: "none",
    fontFamily: "inherit",
  },
  tagRow: { display: "flex", flexWrap: "wrap", marginTop: 2 },
  error: {
    background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.2)",
    color: "#ff8080", padding: "10px 14px", borderRadius: 8, fontSize: 13,
  },
  footer: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 24px", borderTop: "1px solid #1a1a1a", background: "#0d0d0d",
  },
  footerHint: { color: "#333", fontSize: 12 },
  btnSave: {
    background: "#00ff88", color: "#000", border: "none",
    padding: "9px 22px", borderRadius: 8, cursor: "pointer",
    fontWeight: 700, fontSize: 13,
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  btnSaved: { background: "#00cc66" },
};