import { useEffect, useState } from "react"
import { api } from "../api"
import { useAuth } from "../lib/AuthContext"
import { ScheduledJob } from "../../../../shared/types"

export default function Scheduled() {
  const { token } = useAuth()
  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [command, setCommand] = useState("")
  const [repo, setRepo] = useState("")
  const [cron, setCron] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  async function load() {
    const { data } = await api(token!).get("/scheduled")
    setJobs(data)
  }

  useEffect(() => { load() }, [])

  async function create() {
    if (!command.trim() || !repo.trim() || !cron.trim()) return
    setError("")
    setCreating(true)
    try {
      await api(token!).post("/scheduled", { command: command.trim(), repo: repo.trim(), cronExpression: cron.trim() })
      setCommand("")
      setRepo("")
      setCron("")
      load()
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create scheduled job")
    } finally {
      setCreating(false)
    }
  }

  async function toggle(id: string, enabled: boolean) {
    await api(token!).patch(`/scheduled/${id}/toggle`, { enabled })
    load()
  }

  async function remove(id: string) {
    await api(token!).delete(`/scheduled/${id}`)
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }

  const input = "w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm outline-none focus:border-brand-accent"

  return (
    <div className="space-y-8">
      <h2 className="text-xl font-bold text-brand-text">Scheduled Jobs</h2>

      {/* Create form */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-3">
        <h3 className="text-brand-text font-semibold">New Scheduled Job</h3>
        <textarea
          className={input + " resize-none"}
          rows={2}
          placeholder="What do you want to build or fix?"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
        />
        <input className={input} placeholder="owner/repo" value={repo} onChange={(e) => setRepo(e.target.value)} />
        <div>
          <input
            className={input}
            placeholder='Cron expression — e.g. "0 2 * * *" (every night at 2am)'
            value={cron}
            onChange={(e) => setCron(e.target.value)}
          />
          <p className="text-xs text-brand-muted mt-1">
            Format: minute hour day month weekday · <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-brand-accent hover:underline">crontab.guru</a>
          </p>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          onClick={create}
          disabled={creating || !command.trim() || !repo.trim() || !cron.trim()}
          className="bg-brand-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {creating ? "Scheduling..." : "Schedule Job"}
        </button>
      </div>

      {/* Job list */}
      {jobs.length === 0 ? (
        <p className="text-brand-muted text-sm">No scheduled jobs yet.</p>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-brand-text font-medium truncate">{job.command}</p>
                  <p className="text-brand-muted text-xs mt-1">{job.repo}</p>
                  <p className="text-brand-muted text-xs mt-1">{job.humanReadable} <span className="font-mono">({job.cronExpression})</span></p>
                  {job.nextRunAt && (
                    <p className="text-brand-muted text-xs mt-1">Next run: {new Date(job.nextRunAt).toLocaleString()}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${job.enabled ? "bg-green-900 text-green-300" : "bg-zinc-700 text-zinc-400"}`}>
                    {job.enabled ? "enabled" : "paused"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggle(job.id, !job.enabled)}
                      className="text-xs px-3 py-1 rounded bg-brand-bg border border-brand-border text-brand-muted hover:text-brand-text transition-colors"
                    >
                      {job.enabled ? "Pause" : "Enable"}
                    </button>
                    <button
                      onClick={() => remove(job.id)}
                      className="text-xs px-3 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
