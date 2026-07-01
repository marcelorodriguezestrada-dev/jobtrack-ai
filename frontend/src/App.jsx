import { AuthProvider, useAuth } from './hooks/useAuth'
import AuthScreen from './components/AuthScreen'
import JobDashboard from './components/JobDashboard'
import './App.css'

function AppContent() {
  const { user, token, loading, logout } = useAuth()

  if (loading) {
    return <div className="app-loading">Cargando…</div>
  }

  if (!user) {
    return <AuthScreen />
  }

  return <JobDashboard userEmail={user.email} token={token} onLogout={logout} />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}