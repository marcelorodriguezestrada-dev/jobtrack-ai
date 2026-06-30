/**
 * JobTrack AI — Firebase Auth Config & REST Helpers
 * (mismo patrón que pacei/firebase.js, pero solo la parte de Auth
 * — la data de jobs vive en el backend vía Firestore Admin SDK,
 * no se accede directo a Firestore desde el browser)
 *
 * 1. Copiá tus credenciales de Firebase Console (Project Settings → General → Web app)
 * 2. O usá variables de entorno .env.local (recomendado)
 */

export const FB = {
  apiKey: import.meta.env.VITE_FB_API_KEY || 'TU_API_KEY',
}

const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts`

// ── AUTH ─────────────────────────────────────────────────────
export const fbRegister = async (email, password) => {
  const r = await fetch(`${AUTH_URL}:signUp?key=${FB.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const d = await r.json()
  if (d.error) throw new Error(translateFbError(d.error.message))
  return { uid: d.localId, email: d.email, token: d.idToken, refreshToken: d.refreshToken }
}

export const fbLogin = async (email, password) => {
  const r = await fetch(`${AUTH_URL}:signInWithPassword?key=${FB.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const d = await r.json()
  if (d.error) throw new Error(translateFbError(d.error.message))
  return { uid: d.localId, email: d.email, token: d.idToken, refreshToken: d.refreshToken }
}

export const fbSendPasswordReset = async (email) => {
  const r = await fetch(`${AUTH_URL}:sendOobCode?key=${FB.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
  })
  const d = await r.json()
  if (d.error) throw new Error(translateFbError(d.error.message))
  return true
}

export const fbRefreshToken = async (refreshToken) => {
  const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FB.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${refreshToken}`,
  })
  const d = await r.json()
  if (d.error) throw new Error(translateFbError(d.error.message || d.error))
  return { token: d.id_token, refreshToken: d.refresh_token, uid: d.user_id }
}

// Mensajes de Firebase vienen en inglés/códigos crípticos — los traducimos
// a algo legible en español para mostrar en la UI.
function translateFbError(code) {
  const map = {
    EMAIL_EXISTS: 'Ese email ya está registrado. Probá iniciar sesión.',
    EMAIL_NOT_FOUND: 'No encontramos una cuenta con ese email.',
    INVALID_PASSWORD: 'Contraseña incorrecta.',
    INVALID_LOGIN_CREDENTIALS: 'Email o contraseña incorrectos.',
    USER_DISABLED: 'Esta cuenta fue deshabilitada.',
    WEAK_PASSWORD: 'La contraseña necesita al menos 6 caracteres.',
    INVALID_EMAIL: 'Ese email no es válido.',
    MISSING_PASSWORD: 'Falta la contraseña.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos. Probá de nuevo en unos minutos.',
  }
  const key = Object.keys(map).find(k => code?.includes(k))
  return key ? map[key] : 'Algo salió mal. Intentá de nuevo.'
}
