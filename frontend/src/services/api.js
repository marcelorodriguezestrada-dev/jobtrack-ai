/**
 * JobTrack AI — Cliente de API
 * Wrapper de fetch que agrega el token de Firebase a cada request
 * y apunta a la URL del backend según el entorno.
 *
 * NOTA sobre el backend en Render (free tier): el servicio se duerme
 * tras 15 min sin requests, y el primer request después tarda 30-60s
 * en responder (cold start). apiFetch da más tiempo de timeout que el
 * default del browser para no cortar esa primera llamada de golpe.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const COLD_START_TIMEOUT_MS = 70_000

export async function apiFetch(path, { token, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), COLD_START_TIMEOUT_MS)

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('El servidor está demorando en responder. Probá de nuevo en unos segundos.')
    }
    throw new Error('No se pudo conectar con el servidor. Revisá tu conexión.')
  } finally {
    clearTimeout(timeout)
  }

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.error || `Error ${res.status} al llamar ${path}`)
  }

  return data
}

// Atajos para los endpoints más usados
export const api = {
  getJobs: (token, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiFetch(`/api/jobs${qs ? `?${qs}` : ''}`, { token })
  },
  getJob: (token, id) => apiFetch(`/api/jobs/${id}`, { token }),
  updateJob: (token, id, patch) => apiFetch(`/api/jobs/${id}`, { token, method: 'PATCH', body: patch }),
  deleteJob: (token, id) => apiFetch(`/api/jobs/${id}`, { token, method: 'DELETE' }),
  scrape: (token, params) => apiFetch('/api/scrape', { token, method: 'POST', body: params }),
  scrapeStatus: (token) => apiFetch('/api/scrape/status', { token }),
  scrapeLog: (token) => apiFetch('/api/scrape/log', { token }),
  analyzeJob: (token, id) => apiFetch(`/api/jobs/${id}/analyze`, { token, method: 'POST' }),
  generateCover: (token, id) => apiFetch(`/api/jobs/${id}/cover`, { token, method: 'POST' }),
  getInsights: (token) => apiFetch('/api/insights', { token }),
  getStats: (token) => apiFetch('/api/stats', { token }),
  getProfile: (token) => apiFetch('/api/profile', { token }),
  updateProfile: (token, profile) => apiFetch('/api/profile', { token, method: 'PUT', body: profile }),
}
