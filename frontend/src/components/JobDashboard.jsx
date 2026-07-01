import { useState, useEffect, useCallback } from "react";
import { getAuth } from "firebase/auth";

const API = import.meta.env.VITE_API_URL || "https://jobtrack-ai-backend.onrender.com";

const ESTADO_CONFIG = {
  new:        { label: "Nuevo",      color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
  saved:      { label: "Guardado",   color: "#4fc3f7", bg: "rgba(79,195,247,0.1)" },
  applied:    { label: "Aplicado",   color: "#ffd54f", bg: "rgba(255,213,79,0.1)" },
  rejected:   { label: "Descartado", color: "#666",    bg: "rgba(100,100,100,0.1)" },
  interview:  { label: "Entrevista", color: "#ce93d8", bg: "rgba(206,147,216,0.1)" },
};

async function getToken() {
  const user = getAuth().currentUser;
  if (!user) throw new Error("No autenticado");
  return user.getIdToken();
}

async function apiFetch(path, opts = {}) {
  const token = await getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

const FILTROS = ["todos", "new", "saved", "applied", "interview", "rejected"];

export default function JobDashboard({ userEmail = "", onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/jobs");
      setJobs(data.jobs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/stats");
      setStats(data);
      setScraping(data.scrapeInProgress || false);
    } catch {}
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, [fetchJobs, fetchStats]);

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await apiFetch(`/api/jobs/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nuevoEstado }),
      });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: nuevoEstado } : j));
    } catch (e) {
      alert("Error actualizando estado: " + e.message);
    }
  };

  const handleScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try {
      await apiFetch("/api/scrape", { method: "POST", body: JSON.stringify({}) });
      setTimeout(() => { fetchJobs(); fetchStats(); }, 30000);
    } catch (e) {
      alert("Error iniciando scraping: " + e.message);
      setScraping(false);
    }
  };

  const filtrados = filtro === "todos" ? jobs : jobs.filter(j => j.status === filtro);

  const count = (estado) => jobs.filter(j => j.status === estado).length;

  const formatFecha = (val) => {
    if (!val) return "—";
    if (val?.toDate) return val.toDate().toLocaleDateString("es-AR");
    if (typeof val === "string") return val.split("T")[0];
    return "—";
  };

  return (
    <div style={s.root}>
      <header style={s.header}>
        <div style={s.logo}>
          <span style={s.logoGt}>&gt; </span>
          <span style={s.logoBrand}>jobtrack</span>
          <span style={s.logoAi}>.ai</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.userEmail}>{userEmail}</span>
          <button style={s.btnLogout} onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main style={s.main}>
        {/* Metrics */}
        <div style={s.metricsRow}>
          {[
            { label: "Total jobs",  value: jobs.length,        color: "#fff" },
            { label: "Nuevos",      value: count("new"),        color: "#00ff88" },
            { label: "Guardados",   value: count("saved"),      color: "#4fc3f7" },
            { label: "Aplicados",   value: count("applied"),    color: "#ffd54f" },
            { label: "Entrevistas", value: count("interview"),  color: "#ce93d8" },
          ].map(m => (
            <div key={m.label} style={s.metricCard}>
              <span style={{ ...s.metricValue, color: m.color }}>{m.value}</span>
              <span style={s.metricLabel}>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={s.toolbar}>
          <div style={s.filtros}>
            {FILTROS.map(e => {
              const label = e === "todos" ? "Todos"
                : ESTADO_CONFIG[e]?.label || e;
              return (
                <button
                  key={e}
                  style={{ ...s.filtroBtn, ...(filtro === e ? s.filtroBtnActive : {}) }}
                  onClick={() => setFiltro(e)}
                >
                  {label}
                  {e !== "todos" && (
                    <span style={s.filtroBadge}>{count(e)}</span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            style={{ ...s.btnScan, ...(scraping ? s.btnScanLoading : {}) }}
            onClick={handleScrape}
            disabled={scraping}
          >
            {scraping ? "⟳ Buscando..." : "⚡ Buscar ahora"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={s.errorBox}>
            ⚠ {error} — <button style={s.retryBtn} onClick={fetchJobs}>Reintentar</button>
          </div>
        )}

        {/* Table */}
        <div style={s.tableWrap}>
          {loading ? (
            <div style={s.emptyRow}>Cargando empleos…</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Cargo</th>
                  <th style={s.th}>Empresa</th>
                  <th style={s.th}>Fuente</th>
                  <th style={s.th}>Score</th>
                  <th style={s.th}>Fecha</th>
                  <th style={s.th}>Estado</th>
                  <th style={s.th}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={s.emptyRow}>
                      {jobs.length === 0
                        ? "No hay empleos todavía. Hacé click en ⚡ Buscar ahora."
                        : "No hay jobs con ese filtro."}
                    </td>
                  </tr>
                ) : filtrados.map((job, i) => {
                  const est = ESTADO_CONFIG[job.status] || ESTADO_CONFIG["new"];
                  return (
                    <tr key={job.id} style={{ ...s.tr, ...(i % 2 === 0 ? s.trEven : {}) }}>
                      <td style={{ ...s.td, fontWeight: 600, color: "#fff", maxWidth: 240 }}>
                        <a href={job.url} target="_blank" rel="noreferrer" style={s.jobLink}>
                          {job.title}
                        </a>
                      </td>
                      <td style={s.td}>{job.company}</td>
                      <td style={{ ...s.td, color: "#888", fontSize: 12 }}>{job.source}</td>
                      <td style={s.td}>
                        {job.match_score
                          ? <span style={{ color: job.match_score >= 70 ? "#00ff88" : job.match_score >= 40 ? "#ffd54f" : "#888" }}>
                              {job.match_score}%
                            </span>
                          : <span style={{ color: "#333" }}>—</span>}
                      </td>
                      <td style={{ ...s.td, color: "#666", fontSize: 12 }}>
                        {formatFecha(job.scraped_at)}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, color: est.color, background: est.bg }}>
                          {est.label}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={s.actions}>
                          <button style={s.actionBtn} title="Guardar"     onClick={() => cambiarEstado(job.id, "saved")}>🔖</button>
                          <button style={s.actionBtn} title="Aplicado"    onClick={() => cambiarEstado(job.id, "applied")}>✅</button>
                          <button style={s.actionBtn} title="Entrevista"  onClick={() => cambiarEstado(job.id, "interview")}>📅</button>
                          <button style={s.actionBtn} title="Descartar"   onClick={() => cambiarEstado(job.id, "rejected")}>✕</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "#0a0a0a", color: "#ccc", fontFamily: "'Inter', system-ui, sans-serif" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 32px", borderBottom: "1px solid #1a1a1a", background: "#0d0d0d" },
  logo: { fontSize: 20, letterSpacing: -0.5 },
  logoGt: { color: "#00ff88", fontFamily: "monospace" },
  logoBrand: { color: "#fff", fontWeight: 700 },
  logoAi: { color: "#00ff88", fontWeight: 700 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  userEmail: { color: "#555", fontSize: 14 },
  btnLogout: { background: "transparent", border: "1px solid #333", color: "#888", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  main: { padding: "32px", maxWidth: 1300, margin: "0 auto" },
  metricsRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 32 },
  metricCard: { background: "#111", border: "1px solid #1e1e1e", borderRadius: 12, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 4 },
  metricValue: { fontSize: 36, fontWeight: 800, lineHeight: 1 },
  metricLabel: { fontSize: 12, color: "#555", marginTop: 4 },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 },
  filtros: { display: "flex", gap: 8, flexWrap: "wrap" },
  filtroBtn: { background: "transparent", border: "1px solid #222", color: "#666", padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 },
  filtroBtnActive: { borderColor: "#00ff88", color: "#00ff88", background: "rgba(0,255,136,0.05)" },
  filtroBadge: { background: "#1a1a1a", borderRadius: 10, padding: "1px 7px", fontSize: 11, color: "#555" },
  btnScan: { background: "#00ff88", color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  btnScanLoading: { opacity: 0.6, cursor: "not-allowed" },
  errorBox: { background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "#ff8080", padding: "12px 16px", borderRadius: 8, marginBottom: 16, fontSize: 13 },
  retryBtn: { background: "transparent", border: "none", color: "#ff8080", textDecoration: "underline", cursor: "pointer", fontSize: 13 },
  tableWrap: { background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#141414" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: 11, color: "#444", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #1a1a1a" },
  tr: { borderBottom: "1px solid #141414" },
  trEven: { background: "rgba(255,255,255,0.01)" },
  td: { padding: "14px 16px", fontSize: 14, color: "#aaa", verticalAlign: "middle" },
  emptyRow: { padding: 48, textAlign: "center", color: "#444", fontSize: 14 },
  badge: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "1px solid currentColor" },
  jobLink: { color: "inherit", textDecoration: "none" },
  actions: { display: "flex", gap: 4 },
  actionBtn: { background: "transparent", border: "1px solid #222", color: "#555", width: 30, height: 30, borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" },
};