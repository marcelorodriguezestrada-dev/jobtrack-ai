/**
 * scraper.js — Scraping de empleos con Playwright
 * (migrado a Firestore, multi-usuario: todo queda asociado a un uid)
 *
 * Sitios soportados:
 *   - Bumeran (Argentina)
 *   - Indeed (internacional)
 *   - LinkedIn (público, sin login)
 *   - Computrabajo (LATAM)
 *
 * Uso:
 *   node scraper.js <uid> "react developer" "argentina"
 *   o importado como módulo desde server.js: runScrape(uid, options)
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { db, stmts } = require('./db');
const admin = require('firebase-admin');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanText(t) {
  return (t || '').replace(/\s+/g, ' ').trim();
}

function inferTags(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const tagMap = {
    'React': /react(?!\.)/,
    'Vue': /vue\.?js/,
    'Angular': /angular/,
    'TypeScript': /typescript|\.tsx?/,
    'JavaScript': /javascript|\.jsx?/,
    'Node.js': /node\.?js|express/,
    'Python': /python/,
    'Django': /django/,
    'Next.js': /next\.?js/,
    'GraphQL': /graphql/,
    'REST': /rest api|restful/,
    'SQL': /\bsql\b|postgres|mysql/,
    'AWS': /\baws\b|amazon web/,
    'Docker': /docker/,
    'Remote': /remoto|remote/,
    'Híbrido': /híbrido|hybrid/,
    'Sr.': /senior|sr\./,
    'Jr.': /junior|jr\./,
    'Staff': /staff engineer/,
  };
  return Object.entries(tagMap)
    .filter(([, re]) => re.test(text))
    .map(([tag]) => tag)
    .slice(0, 6);
}

// ─── Bumeran scraper ─────────────────────────────────────────────────────────

async function scrapeBumeran(browser, uid, keyword, location = 'argentina') {
  const results = [];
  const page = await browser.newPage();

  try {
    const slug = keyword.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.bumeran.com.ar/empleos-${encodeURIComponent(slug)}.html`;
    console.log(`[Bumeran] Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    try {
      await page.click('button:has-text("Aceptar")', { timeout: 3000 });
    } catch {}

    await page.waitForSelector('[data-qa="posting-list-item"]', { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      const items = document.querySelectorAll('[data-qa="posting-list-item"]');
      return Array.from(items).slice(0, 15).map(el => {
        const titleEl = el.querySelector('[data-qa="posting-name-label"]');
        const companyEl = el.querySelector('[data-qa="posting-company-label"]');
        const locationEl = el.querySelector('[data-qa="posting-location-label"]');
        const salaryEl = el.querySelector('[data-qa="posting-salary-label"]');
        const linkEl = el.querySelector('a[href*="/empleos/"]');
        const descEl = el.querySelector('[data-qa="posting-description-label"]');

        return {
          title: titleEl?.innerText?.trim() || '',
          company: companyEl?.innerText?.trim() || '',
          location: locationEl?.innerText?.trim() || '',
          salary: salaryEl?.innerText?.trim() || '',
          url: linkEl?.href || '',
          description: descEl?.innerText?.trim() || '',
          source: 'bumeran',
          posted_at: new Date().toISOString().split('T')[0],
        };
      });
    });

    console.log(`[Bumeran] Encontrados: ${jobs.length}`);
    results.push(...jobs.filter(j => j.title && j.url));
  } catch (err) {
    console.error('[Bumeran] Error:', err.message);
    await stmts.logScrape(uid, { source: 'bumeran', keyword, found: 0, new_jobs: 0, error: err.message });
  } finally {
    await page.close();
  }

  return results;
}

// ─── Indeed scraper ───────────────────────────────────────────────────────────

async function scrapeIndeed(browser, uid, keyword, location = 'Argentina') {
  const results = [];
  const page = await browser.newPage();

  try {
    const q = encodeURIComponent(keyword);
    const l = encodeURIComponent(location);
    const url = `https://ar.indeed.com/jobs?q=${q}&l=${l}`;
    console.log(`[Indeed] Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);

    try {
      await page.keyboard.press('Escape');
      await page.click('#onetrust-accept-btn-handler', { timeout: 3000 });
    } catch {}

    await page.waitForSelector('[data-jk]', { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      const cards = document.querySelectorAll('div[data-jk]');
      return Array.from(cards).slice(0, 15).map(card => {
        const titleEl = card.querySelector('[class*="jobTitle"] a, h2 a');
        const companyEl = card.querySelector('[data-testid="company-name"], .companyName');
        const locationEl = card.querySelector('[data-testid="text-location"], .companyLocation');
        const salaryEl = card.querySelector('[class*="salary"], [data-testid*="salary"]');
        const descEl = card.querySelector('.job-snippet, [class*="snippet"]');

        return {
          title: titleEl?.innerText?.trim() || '',
          company: companyEl?.innerText?.trim() || '',
          location: locationEl?.innerText?.trim() || '',
          salary: salaryEl?.innerText?.trim() || '',
          url: titleEl?.href || '',
          description: descEl?.innerText?.trim() || '',
          source: 'indeed',
          posted_at: new Date().toISOString().split('T')[0],
        };
      });
    });

    console.log(`[Indeed] Encontrados: ${jobs.length}`);
    results.push(...jobs.filter(j => j.title && j.url));
  } catch (err) {
    console.error('[Indeed] Error:', err.message);
    await stmts.logScrape(uid, { source: 'indeed', keyword, found: 0, new_jobs: 0, error: err.message });
  } finally {
    await page.close();
  }

  return results;
}

// ─── LinkedIn Public scraper (sin login) ─────────────────────────────────────

async function scrapeLinkedIn(browser, uid, keyword, location = 'Argentina') {
  const results = [];
  const page = await browser.newPage();

  try {
    const q = encodeURIComponent(keyword);
    const l = encodeURIComponent(location);
    const url = `https://www.linkedin.com/jobs/search?keywords=${q}&location=${l}&f_TPR=r604800`;
    console.log(`[LinkedIn] Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);

    try {
      await page.click('[data-tracking-control-name="public_jobs_nav-header-signin"]', { timeout: 2000 });
    } catch {}
    try {
      await page.click('.modal__dismiss', { timeout: 2000 });
    } catch {}

    await page.waitForSelector('.jobs-search__results-list', { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      const items = document.querySelectorAll('.jobs-search__results-list li');
      return Array.from(items).slice(0, 15).map(el => {
        const titleEl = el.querySelector('.base-search-card__title, h3');
        const companyEl = el.querySelector('.base-search-card__subtitle, h4');
        const locationEl = el.querySelector('.job-search-card__location, .base-search-card__metadata span');
        const linkEl = el.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
        const timeEl = el.querySelector('time');

        return {
          title: titleEl?.innerText?.trim() || '',
          company: companyEl?.innerText?.trim() || '',
          location: locationEl?.innerText?.trim() || '',
          salary: '',
          url: linkEl?.href?.split('?')[0] || '',
          description: '',
          source: 'linkedin',
          posted_at: timeEl?.getAttribute('datetime') || new Date().toISOString().split('T')[0],
        };
      });
    });

    console.log(`[LinkedIn] Encontrados: ${jobs.length}`);
    results.push(...jobs.filter(j => j.title && j.url));
  } catch (err) {
    console.error('[LinkedIn] Error:', err.message);
    await stmts.logScrape(uid, { source: 'linkedin', keyword, found: 0, new_jobs: 0, error: err.message });
  } finally {
    await page.close();
  }

  return results;
}

// ─── Computrabajo scraper ─────────────────────────────────────────────────────

async function scrapeComputrabajo(browser, uid, keyword, location = '') {
  const results = [];
  const page = await browser.newPage();

  try {
    const slug = keyword.toLowerCase().replace(/\s+/g, '-');
    const url = `https://www.computrabajo.com.ar/trabajo-de-${slug}`;
    console.log(`[Computrabajo] Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000);

    await page.waitForSelector('article.box_offer', { timeout: 15000 });

    const jobs = await page.evaluate(() => {
      const items = document.querySelectorAll('article.box_offer');
      return Array.from(items).slice(0, 15).map(el => {
        const titleEl = el.querySelector('h2 a, .js-o-link');
        const companyEl = el.querySelector('.dIB p, [title]');
        const locationEl = el.querySelector('.fs13.fc_aux');
        const salaryEl = el.querySelector('.salary');

        return {
          title: titleEl?.innerText?.trim() || titleEl?.getAttribute('title') || '',
          company: companyEl?.innerText?.trim() || companyEl?.getAttribute('title') || '',
          location: locationEl?.innerText?.trim() || '',
          salary: salaryEl?.innerText?.trim() || '',
          url: titleEl?.href || '',
          description: '',
          source: 'computrabajo',
          posted_at: new Date().toISOString().split('T')[0],
        };
      });
    });

    console.log(`[Computrabajo] Encontrados: ${jobs.length}`);
    results.push(...jobs.filter(j => j.title && j.url));
  } catch (err) {
    console.error('[Computrabajo] Error:', err.message);
    await stmts.logScrape(uid, { source: 'computrabajo', keyword, found: 0, new_jobs: 0, error: err.message });
  } finally {
    await page.close();
  }

  return results;
}

// ─── Save jobs to DB ──────────────────────────────────────────────────────────

async function saveJobs(uid, jobs) {
  let newCount = 0;
  // Firestore no tiene transacciones masivas tipo better-sqlite3.transaction,
  // así que insertamos uno por uno. insertJob ya hace el equivalente a
  // "INSERT OR IGNORE" comprobando si el doc (uid+url) ya existe.
  for (const job of jobs) {
    const tags = inferTags(job.title, job.description || '');
    const result = await stmts.insertJob(uid, {
      title: cleanText(job.title),
      company: cleanText(job.company),
      location: cleanText(job.location),
      salary: cleanText(job.salary),
      url: job.url,
      description: cleanText(job.description),
      tags, // array nativo, no JSON.stringify (Firestore lo soporta directo)
      source: job.source,
      posted_at: job.posted_at,
    });
    if (result.inserted) newCount++;
  }
  return newCount;
}

// ─── Main scrape function ─────────────────────────────────────────────────────

async function runScrape(uid, options = {}) {
  if (!uid) throw new Error('runScrape requiere un uid de usuario');

  const profile = await stmts.getProfile(uid);
  const keywords = options.keywords
    || profile?.keywords
    || ['frontend developer'];
  const location = options.location
    || process.env.SEARCH_COUNTRY
    || 'Argentina';
  const sources = options.sources || ['bumeran', 'indeed', 'linkedin', 'computrabajo'];

  console.log(`\n🔍 Iniciando scraping (uid: ${uid})`);
  console.log(`   Keywords: ${keywords.join(', ')}`);
  console.log(`   Location: ${location}`);
  console.log(`   Sources: ${sources.join(', ')}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'es-AR',
  });

  const allJobs = [];
  const scraperMap = {
    bumeran: scrapeBumeran,
    indeed: scrapeIndeed,
    linkedin: scrapeLinkedIn,
    computrabajo: scrapeComputrabajo,
  };

  for (const keyword of keywords) {
    for (const source of sources) {
      if (!scraperMap[source]) continue;
      try {
        const jobs = await scraperMap[source](context, uid, keyword, location);
        allJobs.push(...jobs);
        await sleep(2000 + Math.random() * 2000);
      } catch (err) {
        console.error(`Error scraping ${source}:`, err.message);
      }
    }
  }

  await browser.close();

  const newCount = await saveJobs(uid, allJobs);
  console.log(`\n✅ Scraping completo: ${allJobs.length} encontrados, ${newCount} nuevos guardados`);

  return { total: allJobs.length, new: newCount };
}

// ─── CLI usage ────────────────────────────────────────────────────────────────
// node scraper.js <uid> ["keyword"] ["location"]
// El uid es obligatorio porque cada job pertenece a un usuario.

if (require.main === module) {
  const uid = process.argv[2];
  if (!uid) {
    console.error('Uso: node scraper.js <uid> ["keyword"] ["location"]');
    process.exit(1);
  }
  const keyword = process.argv[3] || 'frontend developer';
  const location = process.argv[4] || process.env.SEARCH_COUNTRY || 'Argentina';
  runScrape(uid, { keywords: [keyword], location }).catch(console.error);
}

module.exports = { runScrape };
