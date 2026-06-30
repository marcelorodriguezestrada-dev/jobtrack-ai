import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import './App.css'

function AppContent() {
  const { user, loading, logout } = useAuth()

  if (loading) {
    return <div className="app-loading">Cargando…</div>
  }

  if (!user) {
    return <AuthScreen />
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-header-brand">jobtrack<span className="app-header-accent">.ai</span></span>
        <div className="app-header-user">
          <span>{user.email}</span>
          <button onClick={logout} className="app-logout">Salir</button>
        </div>
      </header>
      <main className="app-main">
        <p>Sesión iniciada. Acá va el dashboard de jobs.</p>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
