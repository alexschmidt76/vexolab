import { useState } from "react"
import axios from "axios"

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000"

export default function Admin() {
  const [stats, setStats] = useState<any>(null)
  const [costs, setCosts] = useState<any[]>([])
  const [secret, setSecret] = useState("")
  const [authed, setAuthed] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    setError("")
    try {
      const headers = { "x-admin-secret": secret }
      const [statsRes, costsRes] = await Promise.all([
        axios.get(`${SERVER_URL}/admin/stats`, { headers }),
        axios.get(`${SERVER_URL}/admin/costs`, { headers }),
      ])
      setStats(statsRes.data)
      setCosts(costsRes.data)
      setAuthed(true)
    } catch {
      setError("Wrong admin secret or server unreachable.")
    }
  }

  if (!authed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-brand-surface border border-brand-border rounded-2xl p-8 w-full max-w-sm">
          <h2 className="text-brand-text text-xl font-bold mb-6">Admin Access</h2>
          <input
            type="password"
            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm mb-3 outline-none focus:border-brand-accent"
            placeholder="Admin secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          {error && <p className="text-red-400 text-xs mb-3">{error}</p>}
          <button
            className="w-full bg-brand-accent text-white py-3 rounded-lg font-semibold hover:bg-indigo-500 transition-colors"
            onClick={load}
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  const STAT_CARDS = [
    { label: "Total Users", value: stats.totalUsers },
    { label: "Free", value: stats.freeUsers },
    { label: "Starter", value: stats.starterUsers },
    { label: "Pro", value: stats.proUsers },
    { label: "Pro+API", value: stats.proApiUsers },
    { label: "MRR", value: `$${stats.mrr}` },
    { label: "Jobs Today", value: stats.jobsToday },
    { label: "Tokens / Month", value: (stats.tokensThisMonth || 0).toLocaleString() },
    { label: "Est. API Cost", value: `$${stats.estimatedCostThisMonth}` },
    { label: "Est. Margin", value: `$${stats.estimatedMargin}`, highlight: true },
  ]

  const marginPositive = parseFloat(stats.estimatedMargin) >= 0

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-text mb-6">Admin Analytics</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {STAT_CARDS.map((s) => (
          <div key={s.label} className="bg-brand-surface border border-brand-border rounded-xl p-4">
            <p className="text-brand-muted text-xs mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${
              s.highlight
                ? marginPositive ? "text-green-400" : "text-red-400"
                : "text-brand-text"
            }`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Profitability banner */}
      {stats.mrr > 0 && (
        <div className={`rounded-xl p-4 mb-8 ${
          marginPositive
            ? "bg-green-900/20 border border-green-800"
            : "bg-red-900/20 border border-red-800"
        }`}>
          <p className={`text-sm font-semibold mb-1 ${marginPositive ? "text-green-300" : "text-red-300"}`}>
            {marginPositive ? "✓ Profitable this month" : "⚠ Running at a loss this month"}
          </p>
          <p className="text-brand-muted text-xs">
            MRR ${stats.mrr} — Est. API cost ${stats.estimatedCostThisMonth} = Est. margin ${stats.estimatedMargin}
          </p>
        </div>
      )}

      {/* Per-user cost table */}
      <p className="text-xs text-brand-muted uppercase tracking-wider mb-3">
        Top Users by Token Usage This Month
      </p>
      <div className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              {["User", "Tier", "Jobs", "Tokens", "Cost to You", "Key"].map((h) => (
                <th key={h} className="text-left p-4 text-brand-muted text-xs font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {costs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-brand-muted text-center text-sm">No usage this month</td>
              </tr>
            ) : (
              costs.map((row, i) => (
                <tr key={i} className="border-b border-brand-border last:border-0">
                  <td className="p-4 text-brand-text font-mono text-xs">@{row.githubUsername}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                      row.tier === "pro_api" ? "bg-brand-accent text-white" :
                      row.tier === "pro" ? "bg-indigo-900 text-indigo-200" :
                      row.tier === "starter" ? "bg-zinc-700 text-zinc-300" :
                      "bg-zinc-800 text-zinc-400"
                    }`}>{row.tier}</span>
                  </td>
                  <td className="p-4 text-brand-text">{row.jobCount}</td>
                  <td className="p-4 text-brand-text">{row.tokensUsed.toLocaleString()}</td>
                  <td className={`p-4 font-semibold ${
                    parseFloat(row.estimatedCostUsd) > 1 ? "text-red-400" :
                    parseFloat(row.estimatedCostUsd) > 0.1 ? "text-yellow-400" :
                    "text-green-400"
                  }`}>${row.estimatedCostUsd}</td>
                  <td className="p-4">
                    <span className={`text-xs ${row.usingPooledKey ? "text-yellow-400" : "text-green-400"}`}>
                      {row.usingPooledKey ? "Pooled" : "Own"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
