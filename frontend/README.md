# JobTrack AI — Frontend

Frontend en React + Vite para JobTrack AI, con login/signup/recuperar
contraseña vía Firebase Authentication.

## Setup local

```bash
npm install
cp .env.example .env.local
```

Completá `.env.local` con:
- `VITE_FB_API_KEY`: la API key pública de tu proyecto Firebase
  (Firebase Console → Project Settings → General → Tus apps → Web app)
- `VITE_API_URL`: la URL de tu backend jobtrack-ai (en local,
  normalmente `http://localhost:3000`; en producción, la URL que
  te da Render para el backend, ej. `https://jobtrack-ai-backend.onrender.com`)

## Antes de arrancar

En Firebase Console → **Authentication → Sign-in method**, habilitá
el proveedor **Email/Password**. Sin esto, login/signup van a fallar
con el error `OPERATION_NOT_ALLOWED`.

## Correr en desarrollo

```bash
npm run dev
```

## Deploy en Render (gratis, Static Site)

Los static sites en Render se sirven desde CDN: no tienen cold starts
(a diferencia del backend, que sí se duerme en el free tier).

1. Subí este repo a GitHub (separado del repo del backend).
2. En [render.com](https://render.com) → **New → Static Site** →
   conectá el repo (o usá **New → Blueprint** con el `render.yaml`
   incluido).
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. En **Environment**, agregá:
   - `VITE_FB_API_KEY` → tu API key pública de Firebase
   - `VITE_API_URL` → la URL de tu backend ya deployado en Render
     (ej. `https://jobtrack-ai-backend.onrender.com`)
6. Deploy. Render te da una URL tipo `https://jobtrack-ai-frontend.onrender.com`.

**Importante**: como las variables `VITE_*` se inyectan en build time
(no en runtime), si cambiás `VITE_API_URL` después del primer deploy
necesitás disparar un nuevo build (no alcanza con solo cambiar la env
var) para que el cambio se refleje.

### Sobre el cold start del backend

Aunque el frontend cargue rápido (CDN, sin sleep), la primera llamada
a la API después de 15 minutos de inactividad del backend puede tardar
30-60 segundos en responder, porque ese servicio sí se duerme en el
free tier de Render. `services/api.js` ya maneja esto con un timeout
largo (70s) y un mensaje claro en vez de cortar la request de golpe.

## Estructura

```
src/
  firebase-client.js      → conexión REST a Firebase Auth (login, signup, reset)
  hooks/
    useAuth.jsx            → contexto de sesión: login, signup, logout, token
  components/
    AuthScreen.jsx         → pantalla de login/signup/recuperar contraseña
    AuthScreen.css
  services/
    api.js                  → wrapper de fetch que agrega el token a cada
                             request al backend (jobtrack-ai server.js)
  App.jsx                  → muestra AuthScreen si no hay sesión, o el
                             dashboard si hay sesión activa
```

## Cómo se conecta con el backend

Cada request al backend necesita el header `Authorization: Bearer <token>`.
El hook `useAuth` expone ese token, y `services/api.js` ya lo agrega
automáticamente:

```jsx
import { useAuth } from './hooks/useAuth'
import { api } from './services/api'

const { token } = useAuth()
const jobs = await api.getJobs(token, { status: 'new' })
```

El backend (jobtrack-ai) debe tener configuradas las variables
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`
(service account) para poder validar ese token con el Admin SDK.
