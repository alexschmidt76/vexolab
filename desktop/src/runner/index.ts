import { runStandard } from "./standard"
import { runClaudeCli, detectClaudeCli } from "./claudeCli"
import axios from "axios"

const SERVER_URL = process.env.VEXOLAB_SERVER_URL || "https://api.vexolab.com"
const TOKEN = process.env.VEXOLAB_TOKEN || ""
const headers = { Authorization: `Bearer ${TOKEN}` }

export type RunnerMode = "auto" | "standard" | "claude-cli"

// decide which runner to actually use for this job
function resolveMode(
  preference: RunnerMode,
  command: string,
  claudeCliAvailable: boolean
): "standard" | "claude-cli" {
  if (preference === "claude-cli") {
    if (!claudeCliAvailable) {
      console.warn("Claude CLI not found — falling back to standard runner")
      return "standard"
    }
    return "claude-cli"
  }

  if (preference === "standard") return "standard"

  // auto: use heuristics to pick the better runner
  if (!claudeCliAvailable) return "standard"

  const complexKeywords = [
    "refactor", "migrate", "fix", "debug", "add tests",
    "update all", "rename", "move", "restructure",
  ]
  return complexKeywords.some((k) => command.toLowerCase().includes(k))
    ? "claude-cli"
    : "standard"
}

export async function processJob(job: any, runnerMode: RunnerMode): Promise<void> {
  const claudeCliAvailable = await detectClaudeCli()
  const mode = resolveMode(runnerMode, job.command, claudeCliAvailable)

  try {
    const result = mode === "claude-cli"
      ? await runClaudeCli(job)
      : await runStandard(job)

    await axios.post(
      `${SERVER_URL}/runner/complete`,
      { jobId: job.id, status: "done", branch: result.branch, prUrl: result.prUrl },
      { headers }
    )
  } catch (err: any) {
    await axios.post(
      `${SERVER_URL}/runner/complete`,
      { jobId: job.id, status: "failed", error: err.message },
      { headers }
    )
  }
}

export { detectClaudeCli }
