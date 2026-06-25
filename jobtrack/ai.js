/**
 * ai.js — Módulo de análisis con IA (Anthropic Claude)
 *
 * Funciones:
 *   analyzeJob(job, profile)     → match score + análisis detallado
 *   batchAnalyze(jobIds)         → analiza múltiples jobs
 *   generateCoverNote(job, profile) → borrador de nota de presentación
 *   getInsights(jobs)            → insights generales del pipeline
 */

require('dotenv').config();
const { db, stmts } = require('./db');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

async function callClaude(messages, systemPrompt, maxTokens = 1024) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY no configurada en .env');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// ─── Analyze single job ───────────────────────────────────────────────────────

async function analyzeJob(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw new Error(`Job ${jobId} no encontrado`);

  const profile = stmts.getProfile.get();
  const skills = JSON.parse(profile.skills || '[]');

  const system = `Sos un career coach experto en tecnología y mercado laboral latinoamericano.
Tu tarea es analizar ofertas de trabajo y dar feedback concreto y accionable en español rioplatense.
Siempre respondés SOLO con JSON válido, sin markdown, sin explicaciones fuera del JSON.`;

  const prompt = `Analizá esta oferta de trabajo para el siguiente perfil de candidato:

PERFIL DEL CANDIDATO:
- Skills: ${skills.join(', ')}
- Años de experiencia: ${profile.experience_years}
- Rol deseado: ${profile.desired_role}

OFERTA:
- Título: ${job.title}
- Empresa: ${job.company}
- Ubicación: ${job.location}
- Salario: ${job.salary || 'No especificado'}
- Fuente: ${job.source}
- Tags detectados: ${job.tags}
- Descripción: ${job.description || 'No disponible'}

Respondé ÚNICAMENTE con este JSON (sin ningún texto extra):
{
  "match_score": 85,
  "veredicto": "frase corta de 6-10 palabras",
  "puntos_fuertes": ["razón 1", "razón 2"],
  "puntos_debiles": ["riesgo 1"],
  "consejo_aplicacion": "qué hacer para maximizar chances",
  "palabras_clave_cv": ["keyword1", "keyword2"],
  "nivel_urgencia": "alta|media|baja",
  "tipo_empresa": "startup|scaleup|enterprise|consultora|agencia",
  "cultura_estimada": "frase sobre la cultura según lo que se lee",
  "salario_estimado": "rango estimado si no fue especificado, o confirma el dado"
}`;

  const raw = await callClaude([{ role: 'user', content: prompt }], system);

  let analysis;
  try {
    const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim();
    analysis = JSON.parse(cleaned);
  } catch {
    analysis = { match_score: 50, veredicto: 'Análisis no disponible', raw };
  }

  stmts.updateJobAnalysis.run({
    match_score: analysis.match_score || 50,
    ai_analysis: JSON.stringify(analysis),
    id: jobId,
  });

  return analysis;
}

// ─── Batch analyze new jobs ───────────────────────────────────────────────────

async function batchAnalyze(limit = 20) {
  const jobs = db.prepare(`
    SELECT id FROM jobs
    WHERE match_score IS NULL OR match_score = 0
    ORDER BY scraped_at DESC
    LIMIT ?
  `).all(limit);

  console.log(`[AI] Analizando ${jobs.length} empleos...`);
  const results = [];

  for (const { id } of jobs) {
    try {
      const analysis = await analyzeJob(id);
      results.push({ id, score: analysis.match_score });
      console.log(`[AI] Job ${id}: ${analysis.match_score}% match — ${analysis.veredicto}`);
      // Rate limiting: 1 request per second
      await new Promise(r => setTimeout(r, 1100));
    } catch (err) {
      console.error(`[AI] Error en job ${id}:`, err.message);
      results.push({ id, error: err.message });
    }
  }

  return results;
}

// ─── Generate cover note ──────────────────────────────────────────────────────

async function generateCoverNote(jobId) {
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId);
  if (!job) throw new Error(`Job ${jobId} no encontrado`);

  const profile = stmts.getProfile.get();
  const skills = JSON.parse(profile.skills || '[]');

  const system = `Sos un experto en comunicación profesional para el mercado tech latinoamericano.
Escribís en español, tono profesional pero cercano, conciso y directo.`;

  const prompt = `Escribí una nota de presentación breve (3-4 párrafos) para aplicar a este trabajo:

EMPRESA: ${job.company}
PUESTO: ${job.title}
DESCRIPCIÓN: ${job.description || 'No disponible'}

MI PERFIL:
- Skills: ${skills.join(', ')}
- Experiencia: ${profile.experience_years} años
- Busco: ${profile.desired_role}

La nota debe:
1. Abrir con algo específico de la empresa (no genérico)
2. Conectar mis skills con lo que piden
3. Terminar con call-to-action concreto
4. Máximo 200 palabras`;

  return callClaude([{ role: 'user', content: prompt }], system, 600);
}

// ─── Pipeline insights ────────────────────────────────────────────────────────

async function getInsights() {
  const jobs = db.prepare(`
    SELECT title, company, status, match_score, source, posted_at, ai_analysis, location
    FROM jobs
    ORDER BY updated_at DESC
    LIMIT 50
  `).all();

  if (jobs.length === 0) return 'No hay empleos en el pipeline todavía. Hacé un scraping primero.';

  const summary = jobs.map(j => ({
    title: j.title,
    company: j.company,
    status: j.status,
    score: j.match_score,
    source: j.source,
    type: j.ai_analysis ? JSON.parse(j.ai_analysis).tipo_empresa : null,
  }));

  const system = `Sos un career coach experto. Analizás datos de búsqueda laboral y dás insights accionables en español.`;

  const prompt = `Analizá estos datos de búsqueda laboral y dá 4-5 insights concretos y accionables:

${JSON.stringify(summary, null, 2)}

Enfocate en:
- Patrones de respuesta (qué tipos de empresas responden más)
- Oportunidades perdidas (aplicaciones sin seguimiento)
- Próximos pasos más prioritarios
- Mejoras a la estrategia de búsqueda

Formato: lista de bullets, máximo 5, español rioplatense, directo y útil.`;

  return callClaude([{ role: 'user', content: prompt }], system, 800);
}

// ─── Follow-up suggestions ────────────────────────────────────────────────────

async function getFollowUpSuggestions() {
  const stale = db.prepare(`
    SELECT id, title, company, status, updated_at
    FROM jobs
    WHERE status IN ('applied', 'aplicado')
    AND updated_at < datetime('now', '-7 days')
  `).all();

  if (stale.length === 0) return [];

  return stale.map(j => ({
    id: j.id,
    title: j.title,
    company: j.company,
    daysAgo: Math.floor((Date.now() - new Date(j.updated_at)) / 86400000),
    suggestion: `Enviá un follow-up email a ${j.company} — pasaron más de 7 días`,
  }));
}

module.exports = {
  analyzeJob,
  batchAnalyze,
  generateCoverNote,
  getInsights,
  getFollowUpSuggestions,
};
