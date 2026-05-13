import { useState, useEffect } from "react"
import { Routes, Route, NavLink, Navigate } from "react-router-dom"
import Dashboard from "./pages/Dashboard"
import Settings from "./pages/Settings"
import Upgrade from "./pages/Upgrade"
import Admin from "./pages/Admin"
import { api } from "./api"

function Login({ onLogin }: { onLogin: (token: string) => void }) {
  const [value, setValue] = useState("")

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-text mb-2">OrvitLab Dashboard</h1>
        <p className="text-brand-muted text-sm mb-6">
          Log in at{" "}
          <a
            href="http://localhost:3000/auth/github"
            target="_blank"
            className="text-brand-accent underline"
          >
            localhost:3000/auth/github
          </a>
          , then paste your token below.
        </p>
        <input
          className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm mb-4 outline-none focus:border-brand-accent"
          placeholder="Paste JWT token..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="w-full bg-brand-accent text-white font-semibold py-3 rounded-lg hover:bg-indigo-500 transition-colors"
          onClick={() => value.trim() && onLogin(value.trim())}
        >
          Sign In
        </button>
      </div>
    </div>
  )
}

function Nav({ user }: { user: any }) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? "bg-brand-surface text-brand-text" : "text-brand-muted hover:text-brand-text"
    }`

  return (
    <nav className="border-b border-brand-border px-6 py-3 flex items-center gap-2">
      <span className="text-brand-text font-bold mr-6">OrvitLab</span>
      <NavLink to="/dashboard" className={linkClass}>Dashboard</NavLink>
      <NavLink to="/settings" className={linkClass}>Settings</NavLink>
      <NavLink to="/upgrade" className={linkClass}>Upgrade</NavLink>
      <NavLink to="/admin" className={linkClass}>Admin</NavLink>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-brand-muted text-sm">{user?.github_username}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
          user?.tier === "free" ? "bg-zinc-700 text-zinc-300" : "bg-brand-accent text-white"
        }`}>{user?.tier}</span>
      </div>
    </nav>
  )
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("orvitlab_token") || "")
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!token) return
    api(token)
      .get("/users/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("orvitlab_token")
        setToken("")
      })
  }, [token])

  function handleLogin(t: string) {
    localStorage.setItem("orvitlab_token", t)
    setToken(t)
  }

  if (!token || !user) return <Login onLogin={handleLogin} />

  return (
    <div className="min-h-screen bg-brand-bg">
      <Nav user={user} />
      <main className="max-w-4xl mx-auto p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard token={token} user={user} />} />
          <Route path="/settings" element={<Settings token={token} user={user} onUpdate={setUser} />} />
          <Route path="/upgrade" element={<Upgrade token={token} user={user} />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  )
}
