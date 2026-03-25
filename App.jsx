import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import AuthPage        from './components/auth/AuthPage'
import HomePage        from './components/table/HomePage'
import CreateTablePage from './components/table/CreateTablePage'
import PokerTablePage  from './components/game/PokerTablePage'

// GitHub Pages uses HashRouter so paths work without server config
function RequireAuth({ children }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-table flex items-center justify-center">
        <div className="text-gold font-display text-2xl animate-pulse">Loading…</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />
  return children
}

export default function App() {
  const init = useAuthStore(s => s.init)
  useEffect(() => { init() }, [])

  return (
    <HashRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={
          <RequireAuth><HomePage /></RequireAuth>
        } />
        <Route path="/create" element={
          <RequireAuth><CreateTablePage /></RequireAuth>
        } />
        <Route path="/table/:tableId" element={
          <RequireAuth><PokerTablePage /></RequireAuth>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
