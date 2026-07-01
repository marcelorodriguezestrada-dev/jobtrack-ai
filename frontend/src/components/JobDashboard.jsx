import { useState } from "react";

const MOCK_JOBS = [
  { id: 1, cargo: "Senior Data Engineer", empresa: "Mercado Libre", fuente: "LinkedIn", fecha: "2026-07-01", estado: "nuevo", url: "#" },
  { id: 2, cargo: "Data Architect", empresa: "Globant", fuente: "Bumeran", fecha: "2026-07-01", estado: "guardado", url: "#" },
  { id: 3, cargo: "Data Engineer Lead", empresa: "Despegar", fuente: "LinkedIn", fecha: "2026-06-30", estado: "aplicado", url: "#" },
  { id: 4, cargo: "Analytics Engineer", empresa: "OLX", fuente: "Indeed", fecha: "2026-06-30", estado: "nuevo", url: "#" },
  { id: 5, cargo: "Staff Data Engineer", empresa: "Ualá", fuente: "LinkedIn", fecha: "2026-06-29", estado: "descartado", url: "#" },
  { id: 6, cargo: "Data Platform Engineer", empresa: "Naranja X", fuente: "GetOnBoard", fecha: "2026-06-29", estado: "guardado", url: "#" },
  { id: 7, cargo: "Senior BI Engineer", empresa: "Personal Flow", fuente: "LinkedIn", fecha: "2026-06-28", estado: "aplicado", url: "#" },
];

const ESTADOS = ["todos", "nuevo", "guardado", "aplicado", "descartado"];

const ESTADO_CONFIG = {
  nuevo:      { label: "Nuevo",      color: "#00ff88", bg: "rgba(0,255,136,0.1)" },
  guardado:   { label: "Guardado",   color: "#4fc3f7", bg: "rgba(79,195,247,0.1)" },
  aplicado:   { label: "Aplicado",   color: "#ffd54f", bg: "rgba(255,213,79,0.1)" },
  descartado: { label: "Descartado", color: "#666",    bg: "rgba(100,100,100,0.1)" },
};

export default function JobDashboard({ userEmail = "usuario@email.com", onLogout }) {
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [filtro, setFiltro] = useState("todos");
  const [scraping, setScraping] = useState(false);
  const [lastScan, setLastScan] = useState("hace 2 horas");

  const metrics = {
    total: jobs.length,
    nuevos: jobs.filter(j => j.estado === "nuevo").length,
    aplicados: jobs.filter(j => j.estado === "aplicado").length,
    guardados: jobs.filter(j => j.estado === "guardado").length,
  };

  const filtrados = filtro === "todos" ? jobs : jobs.filter(j => j.estado === filtro);

  const cambiarEstado = (id, nuevoEstado) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, estado: nuevoEstado } : j));
  };

  const handleScrape = async () => {
    setScraping(true);
    await new Promise(r => setTimeout(r, 2000));
    setScraping(false);
    setLastScan("ahora mismo");
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoGt}>&gt; </span>
          <span style={styles.logoBrand}>jobtrack</span>
          <span style={styles.logoAi}>.ai</span>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.userEmail}>{userEmail}</span>
          <button style={styles.btnLogout} onClick={onLogout}>Salir</button>
        </div>
      </header>

      <main style={styles.main}>
        {/* Metrics */}
        <div style={styles.metricsRow}>
          {[
            { label: "Total jobs", value: metrics.total, color: "#fff" },
            { label: "Nuevos hoy", value: metrics.nuevos, color: "#00ff88" },
            { label: "Guardados", value: metrics.guardados, color: "#4fc3f7" },
            { label: "Aplicados", value: metrics.aplicados, color: "#ffd54f" },
          ].map(m => (
            <div key={m.label} style={styles.metricCard}>
              <span style={{ ...styles.metricValue, color: m.color }}>{m.value}</span>
              <span style={styles.metricLabel}>{m.label}</span>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.filtros}>
            {ESTADOS.map(e => (
              <button
                key={e}
                style={{ ...styles.filtroBtn, ...(filtro === e ? styles.filtroBtnActive : {}) }}
                onClick={() => setFiltro(e)}
              >
                {e.charAt(0).toUpperCase() + e.slice(1)}
                {e !== "todos" && (
                  <span style={styles.filtroBadge}>
                    {jobs.filter(j => j.estado === e).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div style={styles.scanInfo}>
            <span style={styles.lastScan}>Último scan: {lastScan}</span>
            <button
              style={{ ...styles.btnScan, ...(scraping ? styles.btnScanLoading : {}) }}
              onClick={handleScrape}
              disabled={scraping}
            >
              {scraping ? "⟳ Buscando..." : "⚡ Buscar ahora"}
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                <th style={styles.th}>Cargo</th>
                <th style={styles.th}>Empresa</th>
                <th style={styles.th}>Fuente</th>
                <th style={styles.th}>Fecha</th>
                <th style={styles.th}>Estado</th>
                <th style={styles.th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={styles.emptyRow}>
                    No hay jobs con ese filtro todavía.
                  </td>
                </tr>
              ) : filtrados.map((job, i) => {
                const est = ESTADO_CONFIG[job.estado];
                return (
                  <tr key={job.id} style={{ ...styles.tr, ...(i % 2 === 0 ? styles.trEven : {}) }}>
                    <td style={{ ...styles.td, fontWeight: 600, color: "#fff" }}>{job.cargo}</td>
                    <td style={styles.td}>{job.empresa}</td>
                    <td style={{ ...styles.td, color: "#888", fontSize: 13 }}>{job.fuente}</td>
                    <td style={{ ...styles.td, color: "#888", fontSize: 13 }}>{job.fecha}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, color: est.color, background: est.bg }}>
                        {est.label}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.actions}>
                        <button style={styles.actionBtn} onClick={() => cambiarEstado(job.id, "guardado")} title="Guardar">🔖</button>
                        <button style={styles.actionBtn} onClick={() => cambiarEstado(job.id, "aplicado")} title="Marcar como aplicado">✅</button>
                        <button style={styles.actionBtn} onClick={() => cambiarEstado(job.id, "descartado")} title="Descartar">✕</button>
                        <a href={job.url} target="_blank" rel="noreferrer" style={styles.actionBtn} title="Ver oferta">↗</a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#ccc",
    fontFamily: "'Inter', 'system-ui', sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 32px",
    borderBottom: "1px solid #1a1a1a",
    background: "#0d0d0d",
  },
  logo: { fontSize: 20, letterSpacing: -0.5 },
  logoGt: { color: "#00ff88", fontFamily: "monospace" },
  logoBrand: { color: "#fff", fontWeight: 700 },
  logoAi: { color: "#00ff88", fontWeight: 700 },
  headerRight: { display: "flex", alignItems: "center", gap: 16 },
  userEmail: { color: "#555", fontSize: 14 },
  btnLogout: {
    background: "transparent",
    border: "1px solid #333",
    color: "#888",
    padding: "6px 14px",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
  },
  main: { padding: "32px", maxWidth: 1200, margin: "0 auto" },
  metricsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 32,
  },
  metricCard: {
    background: "#111",
    border: "1px solid #1e1e1e",
    borderRadius: 12,
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  metricValue: { fontSize: 36, fontWeight: 800, lineHeight: 1 },
  metricLabel: { fontSize: 13, color: "#555", marginTop: 4 },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 12,
  },
  filtros: { display: "flex", gap: 8, flexWrap: "wrap" },
  filtroBtn: {
    background: "transparent",
    border: "1px solid #222",
    color: "#666",
    padding: "6px 14px",
    borderRadius: 20,
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
  },
  filtroBtnActive: {
    borderColor: "#00ff88",
    color: "#00ff88",
    background: "rgba(0,255,136,0.05)",
  },
  filtroBadge: {
    background: "#1a1a1a",
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 11,
    color: "#555",
  },
  scanInfo: { display: "flex", alignItems: "center", gap: 12 },
  lastScan: { fontSize: 12, color: "#444" },
  btnScan: {
    background: "#00ff88",
    color: "#000",
    border: "none",
    padding: "8px 18px",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  btnScanLoading: { opacity: 0.6, cursor: "not-allowed" },
  tableWrap: {
    background: "#0f0f0f",
    border: "1px solid #1a1a1a",
    borderRadius: 12,
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#141414" },
  th: {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: 11,
    color: "#444",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    borderBottom: "1px solid #1a1a1a",
  },
  tr: { borderBottom: "1px solid #141414", transition: "background 0.1s" },
  trEven: { background: "rgba(255,255,255,0.01)" },
  td: { padding: "14px 16px", fontSize: 14, color: "#aaa", verticalAlign: "middle" },
  emptyRow: { padding: 48, textAlign: "center", color: "#444", fontSize: 14 },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    border: "1px solid currentColor",
  },
  actions: { display: "flex", gap: 4 },
  actionBtn: {
    background: "transparent",
    border: "1px solid #222",
    color: "#555",
    width: 30,
    height: 30,
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    lineHeight: 1,
  },
};