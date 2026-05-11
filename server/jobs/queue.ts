import { Job } from "../../shared/types"
import { runAgent } from "../providers/index"
import { createBranch, commitFile, openPR } from "../github/client"
import crypto from "crypto"

const jobs = new Map<string, Job>()

function updateJob(id: string, updates: Partial<Job>) {
  const job = jobs.get(id)
  if (job) jobs.set(id, { ...job, ...updates, updatedAt: new Date() })
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id)
}

export async function addJob(command: string, repo: string): Promise<Job> {
  const job: Job = {
    id: crypto.randomUUID(),
    command,
    status: "pending",
    branch: null,
    prUrl: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  jobs.set(job.id, job)
  processJob(job.id, repo) // fire and forget
  return job
}

async function processJob(id: string, repo: string) {
  updateJob(id, { status: "running" })

  try {
    const raw = await runAgent(jobs.get(id)!.command)
    const clean = raw.replace(/```json|```/g, "").trim()
    const result = JSON.parse(clean)

    await createBranch(repo, result.branch)

    for (const file of result.files) {
      await commitFile(
        repo,
        result.branch,
        file.path,
        file.content,
        `OrvitLab: ${result.summary}`
      )
    }

    const prUrl = await openPR(
      repo,
      result.branch,
      result.summary,
      `Created by OrvitLab\n\nCommand: "${jobs.get(id)!.command}"`
    )

    updateJob(id, { status: "done", branch: result.branch, prUrl })
  } catch (err: any) {
    updateJob(id, { status: "failed", error: err.message })
  }
}
