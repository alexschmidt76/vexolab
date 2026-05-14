import { Routes, Route, NavLink, Navigate } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Settings from "./pages/Settings"
import Upgrade from "./pages/Upgrade"
import Admin from "./pages/Admin"
import Login from "./pages/Login"
import Thread from "./pages/Thread"
import Scheduled from "./pages/Scheduled"
import { AuthProvider, useAuth } from "./lib/AuthContext"

function Nav() {
  const { user, logout } = useAuth()

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? "bg-brand-surface text-brand-text" : "text-brand-muted hover:text-brand-text"
    }`

  return (
    <nav className="border-b border-brand-border px-6 py-3 flex items-center gap-2">
      <span className="text-brand-text font-bold mr-6">OrvitLab</span>
      <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
      <NavLink to="/scheduled" className={linkClass}>Scheduled</NavLink>
      <NavLink to="/settings" className={linkClass}>Settings</NavLink>
      <NavLink to="/upgrade" className={linkClass}>Upgrade</NavLink>
      <NavLink to="/admin" className={linkClass}>Admin</NavLink>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-brand-muted text-sm">@{user?.githubUsername}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
          user?.tier === "free" ? "bg-zinc-700 text-zinc-300" : "bg-brand-accent text-white"
        }`}>{user?.tier}</span>
        <button
          className="text-brand-muted text-sm hover:text-brand-text transition-colors ml-2"
          onClick={logout}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

function AppContent() {
  const { token, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-muted text-sm">Loading...</div>
      </div>
    )
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <Nav />
      <main className="max-w-4xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/threads/:id" element={<Thread />} />
          <Route path="/scheduled" element={<Scheduled />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
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
