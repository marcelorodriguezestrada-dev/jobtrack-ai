/**
 * server.js — API REST para JobTrack AI
 * (migrado de better-sqlite3 a Firestore, multi-usuario)
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
 *
 * Todas las rutas (salvo que se indique lo contrario) requieren
 * el header: Authorization: Bearer <idToken de Firebase>
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { db, stmts } = require('./db');
const { requireAuth } = require('./auth');
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

app.use(cors({
  origin: [
    'https://jobtrack-ai-frontend.onrender.com',
    'http://localhost:5173',
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Health check público (sin auth) — lo usa Render para saber si el
// servicio está vivo. No expone datos, solo confirma que el proceso responde.
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Todas las rutas /api/* requieren login
app.use('/api', requireAuth);

// ─── Jobs ────────────────────────────────────────────────────────────────────

app.get('/api/jobs', async (req, res) => {
  try {
    const {
      status, source, minScore, search,
      sort = 'scraped_at', order = 'desc',
      limit = 100, offset = 0,
    } = req.query;

    // Traemos todos los jobs del usuario y filtramos/ordenamos.
    // NOTA: Firestore no soporta LIKE para "search" en texto libre,
    // así que ese filtro se aplica en memoria sobre el resultado.
    // Para un tracker personal (decenas/cientos de jobs) esto es
    // perfectamente viable; si en algún momento son miles de jobs
    // por usuario, convendría un servicio de búsqueda aparte (ej. Algolia).
    let jobs = await stmts.getAllJobs(req.user.uid);

    if (status) jobs = jobs.filter(j => j.status === status);
    if (source) jobs = jobs.filter(j => j.source === source);
    if (minScore) jobs = jobs.filter(j => (j.match_score || 0) >= Number(minScore));
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter(j =>
        (j.title || '').toLowerCase().includes(q) ||
        (j.company || '').toLowerCase().includes(q) ||
        (j.description || '').toLowerCase().includes(q)
      );
    }

    const allowedSorts = ['scraped_at', 'match_score', 'company', 'status', 'updated_at'];
    const safeSort = allowedSorts.includes(sort) ? sort : 'scraped_at';
    const dir = order.toLowerCase() === 'asc' ? 1 : -1;
    jobs.sort((a, b) => {
      const av = a[safeSort] ?? '';
      const bv = b[safeSort] ?? '';
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });

    const total = jobs.length;
    const paged = jobs.slice(Number(offset), Number(offset) + Number(limit));

    res.json({ jobs: paged, total });
  } catch (err) {
    console.error('[GET /api/jobs]', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await stmts.getJobById(req.user.uid, req.params.id);
    if (!job) return res.status(404).json({ error: 'No encontrado' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/jobs/:id', async (req, res) => {
  try {
    const { status, notes, next_action, next_action_date } = req.body;
    const id = req.params.id;

    if (status !== undefined) {
      await stmts.updateJobStatus(req.user.uid, { status, id });
    }
    if (notes !== undefined || next_action !== undefined) {
      await stmts.updateJobNotes(req.user.uid, { notes, next_action, next_action_date, id });
    }

    const updated = await stmts.getJobById(req.user.uid, id);
    res.json(updated);
  } catch (err) {
    console.error('[PATCH /api/jobs/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  try {
    // Verificamos pertenencia antes de borrar (mismo criterio que el resto de db.js)
    const job = await stmts.getJobById(req.user.uid, req.params.id);
    if (!job) return res.status(404).json({ error: 'No encontrado' });

    await db.collection('jobs').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Scraping ─────────────────────────────────────────────────────────────────

// NOTA: este estado en memoria (scrapeInProgress) funciona bien en Render
// porque el servicio corre como un único proceso persistente (no serverless
// con múltiples instancias efímeras). Si en el futuro se escala a más de
// una instancia, convendría llevar este flag a Firestore en vez de memoria local.
let scrapeInProgress = false;

app.post('/api/scrape', async (req, res) => {
  if (scrapeInProgress) {
    return res.status(409).json({ error: 'Scraping ya en progreso' });
  }

  const { keywords, location, sources } = req.body;
  const uid = req.user.uid;

  res.json({ ok: true, message: 'Scraping iniciado en background' });

  scrapeInProgress = true;
  try {
    const result = await runScrape(uid, { keywords, location, sources });
    console.log('[Server] Scraping completo:', result);

    if (result.new > 0) {
      console.log('[Server] Analizando nuevos empleos con IA...');
      await batchAnalyze(uid, result.new);
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

app.get('/api/scrape/log', async (req, res) => {
  try {
    const snap = await db.collection('scrape_log')
      .where('user_id', '==', req.user.uid)
      .orderBy('ran_at', 'desc')
      .limit(50)
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI ───────────────────────────────────────────────────────────────────────

app.post('/api/jobs/:id/analyze', async (req, res) => {
  try {
    const analysis = await analyzeJob(req.user.uid, req.params.id);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs/:id/cover', async (req, res) => {
  try {
    const note = await generateCoverNote(req.user.uid, req.params.id);
    res.json({ cover_note: note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/insights', async (req, res) => {
  try {
    const insights = await getInsights(req.user.uid);
    const followUps = await getFollowUpSuggestions(req.user.uid);
    res.json({ insights, followUps });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Stats ────────────────────────────────────────────────────────────────────

app.get('/api/stats', async (req, res) => {
  try {
    // Sin agregaciones SQL (GROUP BY, AVG) en Firestore: traemos los jobs
    // del usuario una vez y calculamos todo en memoria. Para el volumen
    // de un tracker personal esto es liviano.
    const jobs = await stmts.getAllJobs(req.user.uid);

    const total = jobs.length;

    const byStatus = Object.entries(
      jobs.reduce((acc, j) => {
        acc[j.status] = (acc[j.status] || 0) + 1;
        return acc;
      }, {})
    ).map(([status, n]) => ({ status, n }));

    const bySource = Object.entries(
      jobs.reduce((acc, j) => {
        acc[j.source] = (acc[j.source] || 0) + 1;
        return acc;
      }, {})
    ).map(([source, n]) => ({ source, n }));

    const scored = jobs.filter(j => j.match_score > 0);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, j) => s + j.match_score, 0) / scored.length)
      : 0;

    const topMatches = jobs
      .filter(j => j.match_score > 0 && !['rejected', 'rechazado'].includes(j.status))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)
      .map(j => ({ id: j.id, title: j.title, company: j.company, match_score: j.match_score }));

    const recentActivity = [...jobs]
      .sort((a, b) => (b.updated_at?.toMillis?.() || 0) - (a.updated_at?.toMillis?.() || 0))
      .slice(0, 10)
      .map(j => ({ id: j.id, title: j.title, company: j.company, status: j.status, updated_at: j.updated_at }));

    res.json({
      total,
      byStatus,
      bySource,
      avgScore,
      topMatches,
      recentActivity,
      scrapeInProgress,
    });
  } catch (err) {
    console.error('[GET /api/stats]', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Profile ──────────────────────────────────────────────────────────────────

app.get('/api/profile', async (req, res) => {
  try {
    const p = await stmts.getProfile(req.user.uid);
    res.json(p);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const { name, skills, experience_years, desired_role, desired_salary_min,
      desired_salary_max, preferred_locations, keywords } = req.body;

    // A diferencia de SQLite, en Firestore guardamos arrays nativos
    // (no hace falta JSON.stringify de los campos tipo lista).
    await stmts.updateProfile(req.user.uid, {
      name, experience_years, desired_role, desired_salary_min, desired_salary_max,
      skills: skills || [],
      preferred_locations: preferred_locations || [],
      keywords: keywords || [],
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 404 para rutas no encontradas ─────────────────────────────────────────
// (sin SPA fallback: el frontend ahora es un servicio separado en Fly.io)

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ─── Cron job ─────────────────────────────────────────────────────────────────
// NOTA: en Render (plan free) el proceso se duerme tras 15 minutos sin
// requests, así que un cron interno (node-cron) NO va a dispararse si el
// servicio está dormido a esa hora. Para scraping automático confiable en
// el free tier, conviene usar un servicio externo (ej. cron-job.org o
// GitHub Actions con un schedule) que haga un request HTTP a un endpoint
// propio en el horario configurado — eso además despierta el servicio.
// También falta resolver el modelo multi-usuario: este cron tendría que
// iterar sobre todos los usuarios registrados (ej. una colección "users"
// en Firestore) y correr runScrape(uid, ...) para cada uno.

// const cron = require('node-cron');
// const intervalHours = Number(process.env.SCRAPE_INTERVAL_HOURS || 0);
// if (intervalHours > 0) {
//   const cronExpr = `0 */${intervalHours} * * *`;
//   cron.schedule(cronExpr, async () => {
//     console.log(`[Cron] Scraping automático (cada ${intervalHours}h)`);
//     // const users = await getAllActiveUserIds()
//     // for (const uid of users) { ... }
//   });
//   console.log(`[Cron] Scraping programado cada ${intervalHours} horas`);
// }

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🚀 JobTrack AI corriendo en http://localhost:${PORT}`);
  console.log(`   Base de datos: Firestore (proyecto ${process.env.FIREBASE_PROJECT_ID})`);
  console.log(`   API key: ${process.env.ANTHROPIC_API_KEY ? '✓ configurada' : '✗ falta ANTHROPIC_API_KEY'}\n`);
});

module.exports = app;
