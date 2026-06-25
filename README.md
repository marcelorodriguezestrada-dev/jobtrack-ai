# JobTrack AI

App de seguimiento laboral con scraping real y análisis por IA (Claude).

## Stack

- **Backend**: Node.js + Express
- **Scraping**: Playwright (headless Chromium)
- **IA**: Anthropic Claude (análisis de match, insights, notas de presentación)
- **Base de datos**: SQLite (sin configuración extra)
- **Frontend**: HTML/JS vanilla (incluido en `/public`)

## Sitios que scrapeá

| Sitio | Región |
|-------|--------|
| Bumeran | Argentina |
| Indeed AR | Argentina / LATAM |
| LinkedIn | Global (sin login) |
| Computrabajo | Argentina / LATAM |

## Instalación

### 1. Cloná o copiá el proyecto

```bash
cd jobtrack
npm install
```

Playwright necesita descargar Chromium (~200MB la primera vez:
```bash
npx playwright install chromium
```

### 2. Configurá las variables de entorno

```bash
cp .env.example .env
```

Editá `.env`:
```env
ANTHROPIC_API_KEY=sk-ant-api03-...   # ← tu API key de console.anthropic.com
PORT=3000
DEFAULT_KEYWORDS=frontend developer,react developer
SCRAPE_INTERVAL_HOURS=6              # 0 para desactivar el scraping automático
SEARCH_COUNTRY=Argentina
```

### 3. Iniciá el servidor

```bash
npm start
# o en modo watch (auto-restart):
npm run dev
```

Abrí http://localhost:3000

## Uso

### Interfaz web
1. **Configurá tu perfil** → "Mi Perfil" — agregá skills, keywords y años de experiencia. La IA usa esto para calcular el match.
2. **Buscá empleos** → botón "Buscar empleos ahora" en la barra lateral. Scrapeá los 4 sitios automáticamente.
3. **Revisá el pipeline** → Kanban visual con columnas por estado.
4. **Analizá empleos** → clic en cualquier empleo → "Analizar" para que la IA calcule el match y dé consejos.
5. **Insights** → análisis global de tu búsqueda: qué empresas responden más, follow-ups pendientes, etc.

### CLI (scraping directo)
```bash
node scraper.js "react developer" "Argentina"
node scraper.js "ux designer" "Buenos Aires"
```

## API REST

```
GET  /api/jobs              # lista con filtros: ?status=applied&minScore=70&search=react
GET  /api/jobs/:id          # detalle
PATCH /api/jobs/:id         # { status, notes, next_action }
DELETE /api/jobs/:id
POST /api/scrape             # { keywords?, location?, sources? }
GET  /api/scrape/status
POST /api/jobs/:id/analyze   # analiza con IA → devuelve match + análisis
POST /api/jobs/:id/cover     # genera nota de presentación
GET  /api/insights           # análisis general del pipeline
GET  /api/stats
GET  /api/profile
PUT  /api/profile
```

## Notas importantes

- **Scraping responsable**: El scraper usa delays aleatorios entre requests. No lo corras más de una vez por hora para no generar carga excesiva.
- **LinkedIn**: Funciona sin login pero LinkedIn a veces bloquea IPs. Si falla, usá VPN o reducí la frecuencia.
- **API key**: Cada análisis de IA consume tokens. Con el plan Anthropic más básico (~$5), podés analizar cientos de empleos.
- **Base de datos**: `jobtrack.db` se crea automáticamente. Para resetear, borrá el archivo.

## Estructura del proyecto

```
jobtrack/
├── server.js      ← Express API + cron jobs
├── scraper.js     ← Playwright scrapers por sitio
├── ai.js          ← Módulo Claude: análisis, insights, cover notes
├── db.js          ← SQLite setup + prepared statements
├── public/
│   └── index.html ← Frontend SPA completo
├── .env.example
└── package.json
```
