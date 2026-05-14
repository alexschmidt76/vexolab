import { useEffect, useRef, useState } from "react"
import { api } from "../api"
import { useAuth } from "../lib/AuthContext"

import { Job, RunnerType } from "../../../shared/types"
import { useNavigate } from "react-router-dom"

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-900 text-yellow-300",
  running: "bg-blue-900 text-blue-300",
  done: "bg-green-900 text-green-300",
  failed: "bg-red-900 text-red-300",
}

export default function Dashboard() {
  const { token, user } = useAuth()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [command, setCommand] = useState("")
  const [repo, setRepo] = useState("")
  const [runnerType, setRunnerType] = useState<RunnerType>("local")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const navigate = useNavigate()

  function changeRunnerType() {
    if (runnerType === 'local') setRunnerType('cloud');
    else setRunnerType("local");
  }

  async function loadJobs() {
    const r = await api(token!).get("/jobs")
    setJobs(r.data)
  }

  useEffect(() => {
    api(token!)
      .get("/jobs")
      .then((r) => setJobs(r.data))
      .finally(() => setLoading(false))
  }, [token])

  // poll every 3s while any job is pending/running
  useEffect(() => {
    const active = jobs.some((j) => j.status === "pending" || j.status === "running")
    if (active && !pollRef.current) {
      pollRef.current = setInterval(() => {
        api(token!).get("/jobs").then((r) => setJobs(r.data))
      }, 3000)
    } else if (!active && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [jobs, token])

  async function retryJob(jobId: string) {
    await api(token!).post(`/jobs/${jobId}/retry`)
    loadJobs()
  }

  async function deleteJobById(jobId: string) {
    await api(token!).delete(`/jobs/${jobId}`)
    setJobs((prev) => prev.filter((j) => j.id !== jobId))
  }

  async function submitJob() {
    if (!command.trim() || !repo.trim()) return
    setSubmitError("")
    setSubmitting(true)
    try {
      const { data } = await api(token!).post("/jobs", { command: command.trim(), repo: repo.trim(), runnerType: runnerType })
      setJobs((prev) => [data, ...prev])
      setCommand("")
      setRepo("")
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || "Failed to submit job")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Submit form */}
      <div className="bg-brand-surface border border-brand-border rounded-xl p-5 mb-8">
        <h2 className="text-brand-text font-semibold mb-4">New Job</h2>
        <div className="space-y-3">
          <textarea
            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm outline-none focus:border-brand-accent resize-none"
            rows={3}
            placeholder="What do you want to build or fix?"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <input
            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm outline-none focus:border-brand-accent"
            placeholder="owner/repo"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-brand-muted text-xs">
              Using <span className="text-brand-text font-mono">{user?.model || "claude-sonnet-4-6"}</span> via {user?.provider || "anthropic"}
            </span>
            <div className="flex items-center justify-between">
              <span className="text-brand-muted">
                Runner Type:
              </span>
              <label htmlFor="Toggle3" className="inline-flex items-center p-2 rounded-md cursor-pointer dark:text-gray-100">
                <input id="Toggle3" type="checkbox" className="hidden peer" onChange={e => changeRunnerType()}/>
                <span className="rounded-l-lg bg-brand-accent peer-checked:bg-brand-muted text-white text-sm font-semibold px-5 py-2.5">Local</span>
                <span className="rounded-r-lg peer-checked:bg-brand-accent bg-brand-muted text-white text-sm font-semibold px-5 py-2.5">Cloud</span>
              </label>
              {
                runnerType === 'cloud' && user && user.tier === "free" ? (
                  <button
                    className="bg-brand-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
                    onClick={() => navigate('/upgrade')}
                  />
                ) : (
                  <button
                    className="bg-brand-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50"
                    onClick={submitJob}
                    disabled={submitting || !command.trim() || !repo.trim() || !user}
                  >
                    {submitting ? "Submitting..." : "Run Agent"}
                  </button>
                )
              }
            </div>
          </div>
          {submitError && <p className="text-red-400 text-xs">{submitError}</p>}
        </div>
      </div>

      {/* Job history */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-brand-text">Job History</h2>
        <button
          className="text-brand-muted text-xs hover:text-brand-text transition-colors"
          onClick={() => { setLoading(true); loadJobs().finally(() => setLoading(false)) }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-brand-muted text-sm">Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <div className="mt-6 text-center">
          <p className="text-brand-muted">No jobs yet. Submit one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: Job) => (
            <div
              key={job.id}
              className="bg-brand-surface border border-brand-border rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-brand-text font-medium truncate">{job.command}</p>
                  <p className="text-brand-muted text-xs mt-1">{job.repo}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${STATUS_STYLES[job.status]}`}>
                  {job.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-brand-muted">
                <span>{new Date(job.createdAt).toLocaleString()}</span>
                <span className="capitalize">{job.runnerType} runner</span>
                {job.tokensUsed != null && <span>{job.tokensUsed.toLocaleString()} tokens</span>}
                {job.model && <span className="font-mono">{job.model}</span>}
              </div>
              {job.prUrl && (
                <a
                  href={job.prUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-brand-accent hover:underline"
                >
                  View PR →
                </a>
              )}
              {job.error && (
                <p className="mt-2 text-xs text-red-400 bg-red-950 rounded p-2">{job.error}</p>
              )}
              {(job.status === "failed" || job.status === "pending") && (
                <div className="mt-3 flex gap-2">
                  {job.status === "failed" && (
                    <button
                      onClick={() => retryJob(job.id)}
                      className="text-xs px-3 py-1 rounded bg-brand-accent text-white hover:bg-indigo-500 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    onClick={() => deleteJobById(job.id)}
                    className="text-xs px-3 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
