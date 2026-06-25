/**
 * server.js — API REST para JobTrack AI
 *
 * Endpoints:
 *   GET  /api/jobs            → lista de empleos (con filtros)
 *   GET  /api/jobs/:id        → detalle de un empleo
 *   PATCH /api/jobs/:id       → actualizar estado / notas
 *   DELETE /api/jobs/:id      → eliminar empleo
 *   POST /api/scrape          → ejecutar scraping ahora
 *   POST /api/jobs/:id/analyze → analizar con IA
 *   POST /api/jobs/:id/cover  → generar nota de presentación
 *   GET  /api/insights        → insights generales del pipeline
 *   GET  /api/stats           → estadísticas del pipeline
 *   GET  /api/profile         → perfil del usuario
 *   PUT  /api/profile         → actualizar perfil
 *   GET  /api/scrape/log      → historial de scraping
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { db, stmts } = require('./db');
const { runScrape } = require('./scraper');
const {
  analyzeJob,
  batchAnalyze,
  generateCoverNote,
  getInsights,
  getFollowUpSuggestions,
} = require('./ai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Jobs ────────────────────────────────────────────────────────────────────

app.get('/api/jobs', (req, res) => {
  const {
    status, source, minScore, search,
    sort = 'scraped_at', order = 'DESC',
    limit = 100, offset = 0,
  } = req.query;

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (source) {
    query += ` AND source = ?`;
    params.push(source);
  }
  if (minScore) {
    query += ` AND match_score >= ?`;
    params.push(Number(minScore));
  }
  if (search) {
    query += ` AND (title LIKE ? OR company LIKE ? OR description LIKE ?)`;
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const allowedSorts = ['scraped_at', 'match_score', 'company', 'status', 'updated_at'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'scraped_at';
  const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

  query += ` ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const jobs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as n FROM jobs').get().n;

  // Parse JSON fields
  const parsed = jobs.map(j => ({
    ...j,
    tags: safeJSON(j.tags, []),
    ai_analysis: safeJSON(j.ai_analysis, null),
  }));

  res.json({ jobs: parsed, total });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'No encontrado' });
  res.json({
    ...job,
    tags: safeJSON(job.tags, []),
    ai_analysis: safeJSON(job.ai_analysis, null),
  });
});

app.patch('/api/jobs/:id', (req, res) => {
  const { status, notes, next_action, next_action_date } = req.body;
  const id = req.params.id;

  if (status !== undefined) {
    stmts.updateJobStatus.run({ status, id });
  }
  if (notes !== undefined || next_action !== undefined) {
    stmts.updateJobNotes.run({ notes, next_action, next_action_date, id });
  }

  const updated = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  res.json({ ...updated, tags: safeJSON(updated.tags, []), ai_analysis: safeJSON(updated.ai_analysis, null) });
});

app.delete('/api/jobs/:id', (req, res) => {
  db.prepare('DELETE FROM jobs WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Scraping ─────────────────────────────────────────────────────────────────

let scrapeInProgress = false;

app.post('/api/scrape', async (req, res) => {
  if (scrapeInProgress) {
    return res.status(409).json({ error: 'Scraping ya en progreso' });
  }

  const { keywords, location, sources } = req.body;

  // Respond immediately, scrape in background
  res.json({ ok: true, message: 'Scraping iniciado en background' });

  scrapeInProgress = true;
  try {
    const result = await runScrape({ keywords, location, sources });
    console.log('[Server] Scraping completo:', result);

    // Auto-analyze new jobs
    if (result.new > 0) {
      console.log('[Server] Analizando nuevos empleos con IA...');
      await batchAnalyze(result.new);
    }
  } catch (err) {
    console.error('[Server] Scrape error:', err);
  } finally {
    scrapeInProgress = false;
  }
});

app.get('/api/scrape/status', (req, res) => {
  res.json({ inProgress: scrapeInProgress });
});

app.get('/api/scrape/log', (req, res) => {
  const logs = db.prepare('SELECT * FROM scrape_log ORDER BY ran_at DESC LIMIT 50').all();
  res.json(logs);
});

// ─── AI ───────────────────────────────────────────────────────────────────────

app.post('/api/jobs/:id/analyze', async (req, res) => {
  try {
    const analysis = await analyzeJob(Number(req.params.id));
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs/:id/cover', async (req, res) => {
  try {
    const note = await generateCoverNote(Number(req.params.id));
    res.json({ cover_note: note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/insights', async (req, res) => {
  try {
    const insights = await getInsights();
    const followUps = await getFollowUpSuggestions();
    res.json({ insights, followUps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as n FROM jobs').get().n;
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as n FROM jobs GROUP BY status
  `).all();
  const bySource = db.prepare(`
    SELECT source, COUNT(*) as n FROM jobs GROUP BY source
  `).all();
  const avgScore = db.prepare(`
    SELECT AVG(match_score) as avg FROM jobs WHERE match_score > 0
  `).get().avg;
  const topMatches = db.prepare(`
    SELECT id, title, company, match_score FROM jobs
    WHERE match_score > 0 AND status NOT IN ('rejected','rechazado')
    ORDER BY match_score DESC LIMIT 5
  `).all();
  const recentActivity = db.prepare(`
    SELECT id, title, company, status, updated_at FROM jobs
    ORDER BY updated_at DESC LIMIT 10
  `).all();

  res.json({
    total,
    byStatus,
    bySource,
    avgScore: avgScore ? Math.round(avgScore) : 0,
    topMatches,
    recentActivity,
    scrapeInProgress,
  });
});

// ─── Profile ──────────────────────────────────────────────────────────────────

app.get('/api/profile', (req, res) => {
  const p = stmts.getProfile.get();
  res.json({
    ...p,
    skills: safeJSON(p.skills, []),
    keywords: safeJSON(p.keywords, []),
    preferred_locations: safeJSON(p.preferred_locations, []),
  });
});

app.put('/api/profile', (req, res) => {
  const { name, skills, experience_years, desired_role, desired_salary_min,
    desired_salary_max, preferred_locations, keywords } = req.body;

  stmts.updateProfile.run({
    name, experience_years, desired_role, desired_salary_min, desired_salary_max,
    skills: JSON.stringify(skills || []),
    preferred_locations: JSON.stringify(preferred_locations || []),
    keywords: JSON.stringify(keywords || []),
  });

  res.json({ ok: true });
});

// ─── SPA fallback ─────────────────────────────────────────────────────────────

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Cron job ─────────────────────────────────────────────────────────────────

const intervalHours = Number(process.env.SCRAPE_INTERVAL_HOURS || 0);
if (intervalHours > 0) {
  const cronExpr = `0 */${intervalHours} * * *`;
  cron.schedule(cronExpr, async () => {
    console.log(`[Cron] Scraping automático (cada ${intervalHours}h)`);
    if (!scrapeInProgress) {
      scrapeInProgress = true;
      try {
        const result = await runScrape();
        if (result.new > 0) await batchAnalyze(result.new);
      } finally {
        scrapeInProgress = false;
      }
    }
  });
  console.log(`[Cron] Scraping programado cada ${intervalHours} horas`);
}

// ─── Start ────────────────────────────────────────────────────────────────────

function safeJSON(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

app.listen(PORT, () => {
  console.log(`\n🚀 JobTrack AI corriendo en http://localhost:${PORT}`);
  console.log(`   Base de datos: jobtrack.db`);
  console.log(`   API key: ${process.env.ANTHROPIC_API_KEY ? '✓ configurada' : '✗ falta ANTHROPIC_API_KEY'}\n`);
});
