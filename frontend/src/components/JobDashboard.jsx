import { useState, useEffect, useCallback } from "react";
import ProfileModal from "./ProfileModal";

const API = import.meta.env.VITE_API_URL || "https://jobtrack-ai-backend.onrender.com";
const [showProfile, setShowProfile] = useState(false);

const ESTADO_CONFIG = {
  new:       { label: "Nuevo",      color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
  saved:     { label: "Guardado",   color: "#4fc3f7", bg: "rgba(79,195,247,0.1)" },
  applied:   { label: "Aplicado",   color: "#ffd54f", bg: "rgba(255,213,79,0.1)" },
  rejected:  { label: "Descartado", color: "#555",    bg: "rgba(100,100,100,0.1)" },
  interview: { label: "Entrevista", color: "#ce93d8", bg: "rgba(206,147,216,0.1)" },
};

const FILTROS = ["todos", "new", "saved", "applied", "interview", "rejected"];

async function apiFetch(path, token, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// ── Cover Letter Modal ────────────────────────────────────────────────────────

function CoverModal({ job, token, onClose, onApply }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch(`/api/jobs/${job.id}/cover`, token, { method: "POST" })
      .then(d => setText(d.cover_note || ""))
      .catch(e => setText("Error generando la nota: " + e.message))
      .finally(() => setLoading(false));
  }, [job.id, token]);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    window.open(job.url, "_blank");
    onApply(job.id);
    onClose();
  };

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={m.modal} onClick={e => e.stopPropagation()}>
        <div style={m.modalHeader}>
          <div>
            <div style={m.modalTitle}>📝 Cover Letter</div>
            <div style={m.modalSub}>{job.title} · {job.company}</div>
          </div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>

        {job.ai_analysis && (() => {
          try {
            const a = typeof job.ai_analysis === "string"
              ? JSON.parse(job.ai_analysis) : job.ai_analysis;
            return (
              <div style={m.analysisBar}>
                <span style={{ ...m.scorePill, color: job.match_score >= 70 ? "#00ff88" : job.match_score >= 40 ? "#ffd54f" : "#888" }}>
                  {job.match_score}% match
                </span>
                <span style={m.veredicto}>{a.veredicto}</span>
                {a.nivel_urgencia === "alta" && <span style={m.urgencia}>🔥 Alta prioridad</span>}
              </div>
            );
          } catch { return null; }
        })()}

        <div style={m.textWrap}>
          {loading ? (
            <div style={m.generating}>⟳ Claude está generando tu nota personalizada…</div>
          ) : (
            <textarea
              style={m.textarea}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          )}
        </div>

        <div style={m.modalFooter}>
          <div style={m.footerHint}>Podés editar el texto antes de copiar</div>
          <div style={m.footerBtns}>
            <button style={m.btnCopy} onClick={handleCopy} disabled={loading}>
              {copied ? "✓ Copiado" : "📋 Copiar"}
            </button>
            <button style={m.btnApply} onClick={handleApply} disabled={loading}>
              🚀 Postular ahora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Analysis Panel ────────────────────────────────────────────────────────────

function AnalysisPanel({ job, onClose }) {
  if (!job?.ai_analysis) return null;
  const a = typeof job.ai_analysis === "string"
    ? JSON.parse(job.ai_analysis) : job.ai_analysis;

  return (
    <div style={m.overlay} onClick={onClose}>
      <div style={{ ...m.modal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div style={m.modalHeader}>
          <div>
            <div style={m.modalTitle}>🤖 Análisis IA</div>
            <div style={m.modalSub}>{job.title} · {job.company}</div>
          </div>
          <button style={m.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>
          <div style={m.scoreBlock}>
            <span style={{ ...m.scoreBig, color: a.match_score >= 70 ? "#00ff88" : a.match_score >= 40 ? "#ffd54f" : "#888" }}>
              {a.match_score}%
            </span>
            <div>
              <div style={{ color: "#fff", fontWeight: 600 }}>{a.veredicto}</div>
              <div style={{ color: "#555", fontSize: 12, marginTop: 2 }}>
                {a.tipo_empresa} · {a.nivel_urgencia === "alta" ? "🔥 Alta prioridad" : a.nivel_urgencia === "media" ? "Prioridad media" : "Baja prioridad"}
              </div>
            </div>
          </div>

          {a.puntos_fuertes?.length > 0 && (
            <div>
              <div style={m.sectionLabel}>✅ Puntos fuertes</div>
              {a.puntos_fuertes.map((p, i) => <div key={i} style={m.bullet}>· {p}</div>)}
            </div>
          )}
          {a.puntos_debiles?.length > 0 && (
            <div>
              <div style={m.sectionLabel}>⚠ Puntos débiles</div>
              {a.puntos_debiles.map((p, i) => <div key={i} style={{ ...m.bullet, color: "#ff8080" }}>· {p}</div>)}
            </div>
          )}
          {a.consejo_aplicacion && (
            <div style={m.consejo}>
              <div style={m.sectionLabel}>💡 Consejo</div>
              <div style={{ color: "#ccc", fontSize: 14 }}>{a.consejo_aplicacion}</div>
            </div>
          )}
          {a.palabras_clave_cv?.length > 0 && (
            <div>
              <div style={m.sectionLabel}>🔑 Keywords para tu CV</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {a.palabras_clave_cv.map((k, i) => (
                  <span key={i} style={m.keyword}>{k}</span>
                ))}
              </div>
            </div>
          )}
          {a.cultura_estimada && (
            <div style={{ color: "#555", fontSize: 12, borderTop: "1px solid #1a1a1a", paddingTop: 12 }}>
              🏢 {a.cultura_estimada}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function JobDashboard({ userEmail = "", token, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [filtro, setFiltro] = useState("todos");
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState(null);
  const [analyzing, setAnalyzing] = useState({});
  const [coverJob, setCoverJob] = useState(null);
  const [analysisJob, setAnalysisJob] = useState(null);
  const [insights, setInsights] = useState(null);
  const [showInsights, setShowInsights] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      setError(null);
      const data = await apiFetch("/api/jobs", token);
      setJobs(data.jobs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiFetch("/api/stats", token);
      setScraping(data.scrapeInProgress || false);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchJobs();
    fetchStats();
    const iv = setInterval(fetchStats, 15000);
    return () => clearInterval(iv);
  }, [token, fetchJobs, fetchStats]);

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await apiFetch(`/api/jobs/${id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: nuevoEstado }),
      });
      setJobs(prev => prev.map(j => j.id === id ? { ...j, status: nuevoEstado } : j));
    } catch (e) { alert("Error: " + e.message); }
  };

  const handleAnalyze = async (job) => {
    setAnalyzing(prev => ({ ...prev, [job.id]: true }));
    try {
      const analysis = await apiFetch(`/api/jobs/${job.id}/analyze`, token, { method: "POST" });
      setJobs(prev => prev.map(j => j.id === job.id
        ? { ...j, match_score: analysis.match_score, ai_analysis: JSON.stringify(analysis) }
        : j
      ));
      setAnalysisJob({ ...job, match_score: analysis.match_score, ai_analysis: JSON.stringify(analysis) });
    } catch (e) { alert("Error analizando: " + e.message); }
    finally { setAnalyzing(prev => ({ ...prev, [job.id]: false })); }
  };

  const handleScrape = async () => {
    if (scraping) return;
    setScraping(true);
    try {
      await apiFetch("/api/scrape", token, { method: "POST", body: JSON.stringify({}) });
      setTimeout(() => { fetchJobs(); fetchStats(); }, 30000);
    } catch (e) { alert("Error: " + e.message); setScraping(false); }
  };

  const handleInsights = async () => {
    setShowInsights(true);
    if (!insights) {
      try {
        const data = await apiFetch("/api/insights", token);
        setInsights(data.insights);
      } catch (e) { setInsights("Error: " + e.message); }
    }
  };

  const filtrados = filtro === "todos" ? jobs : jobs.filter(j => j.status === filtro);
  const count = (e) => jobs.filter(j => j.status === e).length;

  const formatFecha = (val) => {
    if (!val) return "—";
    if (val?.toDate) return val.toDate().toLocaleDateString("es-AR");
    if (typeof val === "string") return val.split("T")[0];
    return "—";
  };

  const topJobs = [...jobs]
    .filter(j => j.match_score && j.status !== "rejected")
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 3);

  return (
    <div style={s.root}>
      {coverJob && (
        <CoverModal
          job={coverJob}
          token={token}
          onClose={() => setCoverJob(null)}
          onApply={(id) => cambiarEstado(id, "applied")}
        />
      )}
      {analysisJob && (
        <AnalysisPanel job={analysisJob} onClose={() => setAnalysisJob(null)} />
      )}
      {showInsights && (
        <div style={m.overlay} onClick={() => setShowInsights(false)}>
          <div style={{ ...m.modal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div style={m.modalHeader}>
              <div style={m.modalTitle}>💡 Insights del pipeline</div>
              <button style={m.closeBtn} onClick={() => setShowInsights(false)}>✕</button>
            </div>
            <div style={{ padding: "20px 24px", color: "#bbb", fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap", overflowY: "auto" }}>
              {insights || "Generando insights…"}
            </div>
          </div>
        </div>
      )}

            // Antes del header, junto a los otros modales:
            {showProfile && (
            <ProfileModal token={token} onClose={() => setShowProfile(false)} />
            )}



      <header style={s.header}>
        <div style={s.logo}>
          <span style={s.logoGt}>&gt; </span>
          <span style={s.logoBrand}>jobtrack</span>
          <span style={s.logoAi}>.ai</span>
        </div>
        <div style={s.headerRight}>
          <button style={s.btnInsights} onClick={handleInsights}>💡 Insights</button>
          <button style={s.btnInsights} onClick={() => setShowProfile(true)}>⚙ Perfil</button>
          <span style={s.userEmail}>{userEmail}</span>
          <button style={s.btnLogout} onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main style={s.main}>
        <div style={s.metricsRow}>
          {[
            { label: "Total jobs",  value: jobs.length,       color: "#fff" },
            { label: "Nuevos",      value: count("new"),       color: "#00ff88" },
            { label: "Guardados",   value: count("saved"),     color: "#4fc3f7" },
            { label: "Aplicados",   value: count("applied"),   color: "#ffd54f" },
            { label: "Entrevistas", value: count("interview"), color: "#ce93d8" },
          ].map(metric => (
            <div key={metric.label} style={s.metricCard}>
              <span style={{ ...s.metricValue, color: metric.color }}>{metric.value}</span>
              <span style={s.metricLabel}>{metric.label}</span>
            </div>
          ))}
        </div>

        {topJobs.length > 0 && (
          <div style={s.topSection}>
            <div style={s.topTitle}>🏆 Top matches — postulá hoy</div>
            <div style={s.topRow}>
              {topJobs.map(job => (
                <div key={job.id} style={s.topCard}>
                  <div style={s.topScore} onClick={() => setAnalysisJob(job)}>
                    <span style={{ color: job.match_score >= 70 ? "#00ff88" : "#ffd54f", fontSize: 22, fontWeight: 800 }}>
                      {job.match_score}%
                    </span>
                    <span style={{ color: "#555", fontSize: 11 }}>match</span>
                  </div>
                  <div style={s.topInfo}>
                    <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{job.title}</div>
                    <div style={{ color: "#666", fontSize: 12 }}>{job.company}</div>
                  </div>
                  <button style={s.btnQuickApply} onClick={() => setCoverJob(job)}>
                    Cover & postular →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={s.toolbar}>
          <div style={s.filtros}>
            {FILTROS.map(e => (
              <button
                key={e}
                style={{ ...s.filtroBtn, ...(filtro === e ? s.filtroBtnActive : {}) }}
                onClick={() => setFiltro(e)}
              >
                {e === "todos" ? "Todos" : ESTADO_CONFIG[e]?.label || e}
                {e !== "todos" && <span style={s.filtroBadge}>{count(e)}</span>}
              </button>
            ))}
          </div>
          <button
            style={{ ...s.btnScan, ...(scraping ? s.btnScanLoading : {}) }}
            onClick={handleScrape}
            disabled={scraping}
          >
            {scraping ? "⟳ Buscando..." : "⚡ Buscar ahora"}
          </button>
        </div>

        {error && (
          <div style={s.errorBox}>
            ⚠ {error} — <button style={s.retryBtn} onClick={fetchJobs}>Reintentar</button>
          </div>
        )}

        <div style={s.tableWrap}>
          {loading ? (
            <div style={s.emptyRow}>Cargando empleos…</div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {["Cargo", "Empresa", "Fuente", "Score IA", "Fecha", "Estado", "Acciones"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
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
                  const isAnalyzing = analyzing[job.id];
                  return (
                    <tr key={job.id} style={{ ...s.tr, ...(i % 2 === 0 ? s.trEven : {}) }}>
                      <td style={{ ...s.td, fontWeight: 600, color: "#fff", maxWidth: 220 }}>
                        <a href={job.url} target="_blank" rel="noreferrer" style={s.jobLink}>
                          {job.title}
                        </a>
                      </td>
                      <td style={s.td}>{job.company}</td>
                      <td style={{ ...s.td, color: "#666", fontSize: 12 }}>{job.source}</td>
                      <td style={s.td}>
                        {job.match_score
                          ? <button style={s.scoreBtn} onClick={() => setAnalysisJob(job)} title="Ver análisis">
                              <span style={{ color: job.match_score >= 70 ? "#00ff88" : job.match_score >= 40 ? "#ffd54f" : "#888", fontWeight: 700 }}>
                                {job.match_score}%
                              </span>
                            </button>
                          : <button
                              style={{ ...s.btnAnalyze, ...(isAnalyzing ? { opacity: 0.5 } : {}) }}
                              onClick={() => handleAnalyze(job)}
                              disabled={isAnalyzing}
                            >
                              {isAnalyzing ? "⟳" : "🤖 Analizar"}
                            </button>
                        }
                      </td>
                      <td style={{ ...s.td, color: "#555", fontSize: 12 }}>{formatFecha(job.scraped_at)}</td>
                      <td style={s.td}>
                        <span style={{ ...s.badge, color: est.color, background: est.bg }}>
                          {est.label}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={s.actions}>
                          <button style={s.actionBtn} title="Guardar"    onClick={() => cambiarEstado(job.id, "saved")}>🔖</button>
                          <button style={{ ...s.actionBtn, ...s.actionCover }} title="Cover letter & postular" onClick={() => setCoverJob(job)}>✍</button>
                          <button style={s.actionBtn} title="Entrevista" onClick={() => cambiarEstado(job.id, "interview")}>📅</button>
                          <button style={s.actionBtn} title="Descartar"  onClick={() => cambiarEstado(job.id, "rejected")}>✕</button>
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
  logo: { fontSize: 20 },
  logoGt: { color: "#00ff88", fontFamily: "monospace" },
  logoBrand: { color: "#fff", fontWeight: 700 },
  logoAi: { color: "#00ff88", fontWeight: 700 },
  headerRight: { display: "flex", alignItems: "center", gap: 12 },
  userEmail: { color: "#444", fontSize: 13 },
  btnLogout: { background: "transparent", border: "1px solid #2a2a2a", color: "#666", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  btnInsights: { background: "transparent", border: "1px solid #2a2a2a", color: "#888", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  main: { padding: "32px", maxWidth: 1300, margin: "0 auto" },
  metricsRow: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 28 },
  metricCard: { background: "#111", border: "1px solid #1a1a1a", borderRadius: 10, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 4 },
  metricValue: { fontSize: 32, fontWeight: 800, lineHeight: 1 },
  metricLabel: { fontSize: 12, color: "#444" },
  topSection: { marginBottom: 28 },
  topTitle: { color: "#555", fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },
  topRow: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 },
  topCard: { background: "#111", border: "1px solid #1e1e1e", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 },
  topScore: { display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", minWidth: 48 },
  topInfo: { flex: 1, overflow: "hidden" },
  btnQuickApply: { background: "transparent", border: "1px solid #00ff88", color: "#00ff88", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" },
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 },
  filtros: { display: "flex", gap: 6, flexWrap: "wrap" },
  filtroBtn: { background: "transparent", border: "1px solid #1e1e1e", color: "#555", padding: "5px 12px", borderRadius: 20, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 5 },
  filtroBtnActive: { borderColor: "#00ff88", color: "#00ff88", background: "rgba(0,255,136,0.05)" },
  filtroBadge: { background: "#161616", borderRadius: 10, padding: "1px 6px", fontSize: 11, color: "#444" },
  btnScan: { background: "#00ff88", color: "#000", border: "none", padding: "8px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  btnScanLoading: { opacity: 0.5, cursor: "not-allowed" },
  errorBox: { background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,80,80,0.15)", color: "#ff8080", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13 },
  retryBtn: { background: "transparent", border: "none", color: "#ff8080", textDecoration: "underline", cursor: "pointer", fontSize: 13 },
  tableWrap: { background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 12, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { padding: "11px 14px", textAlign: "left", fontSize: 11, color: "#333", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, borderBottom: "1px solid #161616", background: "#111" },
  tr: { borderBottom: "1px solid #141414" },
  trEven: { background: "rgba(255,255,255,0.008)" },
  td: { padding: "13px 14px", fontSize: 13, color: "#888", verticalAlign: "middle" },
  emptyRow: { padding: 48, textAlign: "center", color: "#333", fontSize: 14 },
  jobLink: { color: "inherit", textDecoration: "none" },
  badge: { display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid currentColor" },
  scoreBtn: { background: "transparent", border: "none", cursor: "pointer", padding: 0 },
  btnAnalyze: { background: "transparent", border: "1px solid #252525", color: "#666", padding: "4px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  actions: { display: "flex", gap: 4 },
  actionBtn: { background: "transparent", border: "1px solid #1e1e1e", color: "#444", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" },
  actionCover: { borderColor: "#2a3a2a", color: "#00bb66" },
};

const m = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#111", border: "1px solid #222", borderRadius: 14, width: "100%", maxWidth: 640, maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 24px 16px", borderBottom: "1px solid #1a1a1a" },
  modalTitle: { color: "#fff", fontWeight: 700, fontSize: 16 },
  modalSub: { color: "#555", fontSize: 13, marginTop: 2 },
  closeBtn: { background: "transparent", border: "none", color: "#444", fontSize: 18, cursor: "pointer" },
  analysisBar: { display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", background: "#0d0d0d", borderBottom: "1px solid #1a1a1a" },
  scorePill: { fontWeight: 800, fontSize: 18 },
  veredicto: { color: "#888", fontSize: 13, flex: 1 },
  urgencia: { color: "#ff9800", fontSize: 12 },
  textWrap: { flex: 1, overflow: "auto", padding: 24 },
  generating: { color: "#555", fontSize: 14, textAlign: "center", padding: 40 },
  textarea: { width: "100%", minHeight: 220, background: "#0d0d0d", border: "1px solid #222", borderRadius: 8, color: "#ccc", fontSize: 14, lineHeight: 1.7, padding: 16, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" },
  modalFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: "1px solid #1a1a1a", background: "#0d0d0d" },
  footerHint: { color: "#333", fontSize: 12 },
  footerBtns: { display: "flex", gap: 10 },
  btnCopy: { background: "transparent", border: "1px solid #333", color: "#888", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  btnApply: { background: "#00ff88", color: "#000", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13 },
  scoreBlock: { display: "flex", alignItems: "center", gap: 16, background: "#0d0d0d", padding: "14px 16px", borderRadius: 10 },
  scoreBig: { fontSize: 42, fontWeight: 900, lineHeight: 1 },
  sectionLabel: { color: "#444", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  bullet: { color: "#aaa", fontSize: 13, lineHeight: 1.7 },
  consejo: { background: "rgba(0,255,136,0.04)", border: "1px solid rgba(0,255,136,0.1)", borderRadius: 8, padding: 14 },
  keyword: { background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#888", padding: "3px 10px", borderRadius: 20, fontSize: 12 },
};