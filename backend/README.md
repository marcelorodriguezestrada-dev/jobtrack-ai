# JobTrack AI — Backend

API REST con scraping (Playwright), análisis con IA (Claude) y
persistencia en Firestore. Multi-usuario: cada job, perfil y log
queda asociado al `uid` del usuario autenticado con Firebase Auth.

## Stack

- Express + Firestore (Firebase Admin SDK)
- Playwright (Bumeran, Indeed, LinkedIn, Computrabajo)
- Anthropic Claude (análisis de match + insights + cover notes)
- Docker (imagen oficial de Playwright, incluye Chromium + deps)

## Setup local

```bash
npm install
cp .env.example .env
```

Completá `.env` con:
- `ANTHROPIC_API_KEY`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  (Firebase Console → Project Settings → Cuentas de servicio →
  Generar nueva clave privada)

```bash
npm run dev
```

El server arranca en `http://localhost:3000`. Cada request a `/api/*`
necesita el header `Authorization: Bearer <idToken>` (lo provee el
frontend después del login).

## Deploy en Render (gratis)

1. Subí este repo a GitHub.
2. En [render.com](https://render.com) → **New → Web Service** →
   conectá el repo. Render detecta el `Dockerfile` automáticamente
   (o usá el `render.yaml` incluido como Blueprint: **New → Blueprint**).
3. Plan: **Free**.
4. En **Environment**, agregá las variables de `.env.example`
   (`ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`,
   `FIREBASE_PRIVATE_KEY`, etc.). La `FIREBASE_PRIVATE_KEY` pegala
   completa, con los `\n` literales tal como vienen en el JSON del
   service account — el código ya la convierte a salto de línea real.
5. Deploy. Render te da una URL tipo `https://jobtrack-ai-backend.onrender.com`.

### Limitaciones del free tier de Render a tener en cuenta

- **Spin-down por inactividad**: el servicio se duerme tras 15 minutos
  sin requests, y el primer request después tarda 30-60s en responder
  (cold start). Para un tracker personal esto es tolerable.
- **Scraping puede cortarse a mitad**: si el proceso se duerme mientras
  `runScrape` está corriendo, el scraping se interrumpe. Si te pasa
  seguido, una opción es pingear `/health` cada par de minutos durante
  el scraping (desde un cron externo gratuito como cron-job.org) para
  mantenerlo despierto, o pasar ese servicio puntual a un plan pago.
- **Sin filesystem persistente entre deploys**: no es un problema para
  este proyecto porque toda la data vive en Firestore, no en disco local.

## Estructura

```
server.js     → rutas Express, todas protegidas con requireAuth salvo /health
auth.js       → middleware que valida el idToken de Firebase en cada request
db.js         → conexión a Firestore + funciones CRUD (todas piden uid)
scraper.js    → scraping con Playwright (Bumeran, Indeed, LinkedIn, Computrabajo)
ai.js         → llamadas a Claude (análisis, cover notes, insights)
Dockerfile    → imagen con Playwright + Chromium preinstalado
render.yaml   → blueprint de deploy en Render
```

## Notas sobre la migración desde SQLite

Este proyecto originalmente usaba `better-sqlite3` con un archivo
local. Se migró a Firestore porque:

1. El filesystem de la mayoría de los hosts (incluido Render en
   redeploys) no garantiza persistencia de archivos locales entre
   despliegues.
2. Se agregó autenticación multi-usuario (Firebase Auth), y Firestore
   permite estructurar los datos por `uid` de forma natural.

Diferencias a tener en cuenta si volvés a tocar el código:
- Los campos que antes eran `TEXT` con JSON-string (`tags`, `skills`,
  `keywords`, etc.) ahora son arrays nativos de Firestore — no hace
  falta `JSON.stringify`/`JSON.parse` para esos campos.
- No hay `GROUP BY`/`AVG` server-side: las agregaciones de `/api/stats`
  se calculan en memoria sobre los jobs ya traídos.
- El filtro `search` de `/api/jobs` (antes un `LIKE` de SQL) ahora se
  hace en memoria, porque Firestore no soporta búsqueda de texto parcial.
