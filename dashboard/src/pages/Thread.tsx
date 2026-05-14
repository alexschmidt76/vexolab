import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { api } from "../api"
import { useAuth } from "../lib/AuthContext"
import { JobThread, JobIteration } from "../../../shared/types"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900 text-yellow-300",
  running: "bg-blue-900 text-blue-300",
  done: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
}

export default function Thread() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [thread, setThread] = useState<JobThread | null>(null)
  const [iterations, setIterations] = useState<JobIteration[]>([])
  const [errorReport, setErrorReport] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    const { data } = await api(token!).get(`/threads/${id}`)
    setThread(data.thread)
    setIterations(data.iterations)
  }

  useEffect(() => {
    load()
  }, [id])

  useEffect(() => {
    const active = iterations.some((i) => i.status === "pending" || i.status === "running")
    if (active && !pollRef.current) {
      pollRef.current = setInterval(load, 3000)
    } else if (!active && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } }
  }, [iterations])

  async function submitRepair() {
    if (!errorReport.trim()) return
    setSubmitting(true)
    try {
      await api(token!).post(`/threads/${id}/repair`, { errorReport: errorReport.trim() })
      setErrorReport("")
      load()
    } catch (err: any) {
      setWarning(err.response?.data?.error || "Repair failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function resolve() {
    await api(token!).post(`/threads/${id}/resolve`)
    load()
  }

  async function abandon() {
    await api(token!).post(`/threads/${id}/abandon`)
    navigate("/dashboard")
  }

  if (!thread) return <p className="text-brand-muted text-sm">Loading thread...</p>

  const isOpen = thread.status === "open"

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/dashboard")} className="text-brand-muted text-sm hover:text-brand-text">← Back</button>
        <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${
          thread.status === "open" ? "bg-blue-900 text-blue-300" :
          thread.status === "resolved" ? "bg-green-900 text-green-300" : "bg-zinc-700 text-zinc-300"
        }`}>{thread.status}</span>
      </div>

      <div>
        <h2 className="text-xl font-bold text-brand-text">{thread.originalCommand}</h2>
        <p className="text-brand-muted text-xs mt-1">{thread.repo} · {thread.iterationCount} attempt{thread.iterationCount !== 1 ? "s" : ""}</p>
        {thread.prUrl && (
          <a href={thread.prUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-accent hover:underline">
            View PR →
          </a>
        )}
      </div>

      {/* Iteration history */}
      <div className="space-y-3">
        {iterations.map((iter) => (
          <div key={iter.id} className="bg-brand-surface border border-brand-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-brand-muted text-xs">Attempt #{iter.iterationNumber}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[iter.status]}`}>{iter.status}</span>
            </div>
            {iter.errorReport && (
              <p className="text-red-400 text-xs mb-2 bg-red-950 rounded p-2">Error: {iter.errorReport}</p>
            )}
            {iter.selfReview && (
              <p className="text-brand-muted text-xs mb-2">Review: {iter.selfReview}</p>
            )}
            {iter.buildOutput && !iter.buildOutput.includes("No issues") && (
              <p className="text-yellow-400 text-xs bg-yellow-950 rounded p-2">Build: {iter.buildOutput.slice(0, 200)}</p>
            )}
            <p className="text-brand-muted text-xs mt-2">{new Date(iter.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Warning banner */}
      {warning && (
        <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-4 flex items-start justify-between">
          <p className="text-yellow-300 text-sm">{warning}</p>
          <button onClick={() => setWarning(null)} className="text-yellow-500 text-xs ml-4 shrink-0">Dismiss</button>
        </div>
      )}

      {/* Repair input */}
      {isOpen && (
        <div className="bg-brand-surface border border-brand-border rounded-xl p-5 space-y-4">
          <h3 className="text-brand-text font-semibold">Request a Repair</h3>
          <textarea
            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm outline-none focus:border-brand-accent resize-none"
            rows={3}
            placeholder="Describe what's wrong — e.g. 'The button doesn't appear on mobile, the import is missing...'"
            value={errorReport}
            onChange={(e) => setErrorReport(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              onClick={submitRepair}
              disabled={submitting || !errorReport.trim()}
              className="bg-brand-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Request Repair"}
            </button>
            {thread.prUrl && (
              <button
                onClick={resolve}
                className="bg-green-800 text-green-200 text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors"
              >
                Mark Resolved ✓
              </button>
            )}
            <button
              onClick={abandon}
              className="text-brand-muted text-sm px-4 py-2.5 rounded-lg hover:text-brand-text border border-brand-border transition-colors"
            >
              Abandon
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
