import { Queue, Worker, Job as BullJob } from "bullmq"
import IORedis from "ioredis"
import config from "../config/index"
import { runAgent } from "../providers/index"
import { createBranch, commitFile, openPR } from "../github/client"
import { notifyUser } from "../notifications/index"
import { db } from "../db/index"
import { Provider } from "../../shared/types"

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

export const jobQueue = new Queue("orvitlab-jobs", { connection })

// update a job's fields directly — avoids circular imports with queue.ts
async function dbUpdateJob(id: string, updates: Record<string, any>) {
  await db.from("jobs").update(updates).eq("id", id)
}

// process a single cloud job: run the agent, commit files, open a PR
async function processJob(bull: BullJob) {
  const { jobId, command, repo, apiKey, githubToken, userId, provider, model } = bull.data
  await dbUpdateJob(jobId, { status: "running" })

  try {
    const raw = await runAgent(command, provider as Provider, apiKey, model)
    const result = JSON.parse(raw)
    const { tokensUsed } = result

    await createBranch(repo, result.branch, githubToken)
    for (const file of result.files) {
      await commitFile(
        repo,
        result.branch,
        file.path,
        file.content,
        `OrvitLab: ${result.summary}`,
        githubToken
      )
    }

    const prUrl = await openPR(
      repo,
      result.branch,
      result.summary,
      `Created by OrvitLab\n\nCommand: "${command}"`,
      githubToken
    )

    await db.from("token_usage").insert({ user_id: userId, job_id: jobId, tokens_used: tokensUsed })

    await dbUpdateJob(jobId, {
      status: "done",
      branch: result.branch,
      pr_url: prUrl,
      tokens_used: tokensUsed,
    })

    await notifyUser(userId, "Job Complete", `PR opened: ${result.summary}`)
  } catch (err: any) {
    await dbUpdateJob(jobId, { status: "failed", error: err.message })
    await notifyUser(userId, "Job Failed", err.message)
  }
}

// start the BullMQ worker — call this once at server startup
export function startWorker(): Worker {
  return new Worker("orvitlab-jobs", processJob, { connection })
}
