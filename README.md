# JobTrack AI

Monorepo con dos proyectos independientes que se deployan como dos
servicios distintos en Render, a partir de un único `render.yaml`
(Render Blueprint).

```
jobtrack-ai/
  backend/      → API REST (Express + Firestore + Playwright + Claude)
  frontend/     → React + Vite (login/signup vía Firebase Auth)
  render.yaml   → define ambos servicios con su rootDir correspondiente
```

Cada carpeta tiene su propio `README.md` con detalle de setup local.

## Deploy (Render Blueprint)

1. Subí este repo completo a GitHub (un solo repo, con ambas carpetas).
2. En [render.com](https://render.com) → **New → Blueprint** → conectá
   el repo. Render lee `render.yaml` y propone crear los dos servicios
   automáticamente (`jobtrack-ai-backend` y `jobtrack-ai-frontend`).
3. Antes de confirmar, Render te va a pedir completar las env vars
   marcadas `sync: false` en el blueprint:
   - Backend: `ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID`,
     `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SEARCH_COUNTRY`,
     `DEFAULT_KEYWORDS`
   - Frontend: `VITE_FB_API_KEY`, `VITE_API_URL`

### Sobre el orden de deploy y `VITE_API_URL`

El frontend necesita la URL pública del backend para saber a dónde
mandar los requests. Esa URL (`https://jobtrack-ai-backend.onrender.com`,
con el sufijo exacto que Render le asigne) solo existe **después** de
que el backend se deployó al menos una vez. Si es tu primer deploy:

1. Dejá `VITE_API_URL` vacío o con cualquier valor placeholder.
2. Deployá el blueprint — el backend va a quedar arriba con su URL real.
3. Copiá esa URL → Render dashboard → servicio `jobtrack-ai-frontend`
   → Environment → actualizá `VITE_API_URL` con la URL real.
4. Disparás un **manual redeploy** del frontend (las env vars `VITE_*`
   se inyectan en build time, así que un cambio de env var sin
   redeploy no alcanza).

## Por qué dos servicios y no uno

Backend y frontend son tipos de servicio distintos en Render:
- El backend es un **Web Service** (proceso Node.js persistente,
  corre en Docker, necesita estar "vivo" para Playwright/Firestore).
- El frontend es un **Static Site** (archivos ya compilados servidos
  desde CDN, sin proceso corriendo, sin cold start).

Por eso viven en carpetas separadas dentro del mismo repo, cada una
con su propio `package.json`, y el `render.yaml` en la raíz le dice a
Render cómo tratar cada una (`rootDir` + `runtime` distintos).
