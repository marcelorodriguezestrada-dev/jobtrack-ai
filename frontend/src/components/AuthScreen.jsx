/**
 * JobTrack AI — Pantalla de autenticación
 * Login / Signup / Recuperar contraseña en una sola pantalla con tabs.
 */
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import './AuthScreen.css'

const MODES = {
  LOGIN: 'login',
  SIGNUP: 'signup',
  RESET: 'reset',
}

export default function AuthScreen() {
  const [mode, setMode] = useState(MODES.LOGIN)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [localError, setLocalError] = useState(null)

  const { login, signup, resetPassword, error, setError } = useAuth()

  const switchMode = (next) => {
    setMode(next)
    setError(null)
    setLocalError(null)
    setResetSent(false)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLocalError(null)

    if (mode === MODES.SIGNUP && password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      if (mode === MODES.LOGIN) {
        await login(email, password)
      } else if (mode === MODES.SIGNUP) {
        await signup(email, password)
      } else if (mode === MODES.RESET) {
        const ok = await resetPassword(email)
        if (ok) setResetSent(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-brand-mark" aria-hidden="true">{'>'}</span>
          <span className="auth-brand-name">jobtrack<span className="auth-brand-ai">.ai</span></span>
        </div>

        <p className="auth-tagline">Tu pipeline de búsqueda laboral, en piloto automático.</p>

        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === MODES.LOGIN}
            className={`auth-tab ${mode === MODES.LOGIN ? 'auth-tab-active' : ''}`}
            onClick={() => switchMode(MODES.LOGIN)}
          >
            Ingresar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === MODES.SIGNUP}
            className={`auth-tab ${mode === MODES.SIGNUP ? 'auth-tab-active' : ''}`}
            onClick={() => switchMode(MODES.SIGNUP)}
          >
            Crear cuenta
          </button>
        </div>

        {mode === MODES.RESET ? (
          <div className="auth-reset-header">
            <p className="auth-reset-title">Recuperar contraseña</p>
            <p className="auth-reset-copy">
              Te mandamos un link para elegir una contraseña nueva.
            </p>
          </div>
        ) : null}

        {resetSent ? (
          <div className="auth-success">
            <p>Listo. Revisá tu email para continuar.</p>
            <button type="button" className="auth-link" onClick={() => switchMode(MODES.LOGIN)}>
              Volver a ingresar
            </button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span className="auth-label">Email</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            {mode !== MODES.RESET && (
              <label className="auth-field">
                <span className="auth-label">Contraseña</span>
                <input
                  type="password"
                  autoComplete={mode === MODES.SIGNUP ? 'new-password' : 'current-password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
            )}

            {mode === MODES.SIGNUP && (
              <label className="auth-field">
                <span className="auth-label">Confirmar contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </label>
            )}

            {mode === MODES.LOGIN && (
              <button
                type="button"
                className="auth-link auth-link-inline"
                onClick={() => switchMode(MODES.RESET)}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {displayError && (
              <div className="auth-error" role="alert">{displayError}</div>
            )}

            <button type="submit" className="auth-submit" disabled={submitting}>
              {submitting ? 'Procesando…' : submitLabel(mode)}
            </button>

            {mode === MODES.RESET && (
              <button
                type="button"
                className="auth-link"
                onClick={() => switchMode(MODES.LOGIN)}
              >
                Volver a ingresar
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function submitLabel(mode) {
  if (mode === MODES.SIGNUP) return 'Crear cuenta'
  if (mode === MODES.RESET) return 'Enviar link'
  return 'Ingresar'
}
