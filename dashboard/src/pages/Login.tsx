import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "../lib/AuthContext"

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000"

export default function Login() {
  const { login, token } = useAuth()
  const [value, setValue] = useState("")
  const [params] = useSearchParams()
  const navigate = useNavigate()

  // auto-login when GitHub OAuth redirects back with ?token=
  useEffect(() => {
    const t = params.get("token")
    if (t) {
      login(t).then(() => navigate("/dashboard", { replace: true }))
    }
  }, [])

  useEffect(() => {
    if (token) navigate("/dashboard", { replace: true })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-brand-bg">
      <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-brand-text mb-1">OrvitLab</h1>
        <p className="text-brand-muted text-sm mb-8">Command from anywhere.</p>

        <a
          href={`${SERVER_URL}/auth/github?platform=web`}
          className="block w-full bg-brand-surface border border-zinc-700 text-brand-text font-semibold text-center py-3 rounded-lg mb-8 hover:border-brand-accent transition-colors"
        >
          Continue with GitHub
        </a>

        <p className="text-brand-muted text-xs uppercase tracking-wider mb-2">Or paste JWT token</p>
        <input
          className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm mb-4 outline-none focus:border-brand-accent"
          placeholder="Paste token..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="w-full bg-brand-accent text-white font-semibold py-3 rounded-lg hover:bg-indigo-500 transition-colors"
          onClick={() => value.trim() && login(value.trim())}
        >
          Sign In
        </button>
      </div>
    </div>
  )
}
