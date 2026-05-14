import { Queue, Worker, Job as BullJob } from "bullmq"
import IORedis from "ioredis"
import config from "../config/index"
import { runAgent } from "../providers/index"
import { createBranch, commitFile, openPR } from "../github/client"
import { getRepoConfig } from "../github/repoConfig"
import { reviewOutput } from "./selfReview"
import { runBuildCheck } from "./buildCheck"
import { sendNotification } from "../notifications/index"
import { db } from "../db/index"
import { Provider } from "../../shared/types"

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })
connection.on("error", (err) => console.error("Redis connection error:", err.message))

export const jobQueue = new Queue("orvitlab-jobs", { connection })
jobQueue.on("error", (err) => console.error("BullMQ queue error:", err.message))

async function dbUpdateJob(id: string, updates: Record<string, any>) {
  await db.from("jobs").update(updates).eq("id", id)
}

async function processJob(bull: BullJob) {
  if (bull.name === "process-repair") {
    return processRepair(bull)
  }

  const { jobId, command, repo, apiKey, githubToken, userId, provider, model } = bull.data
  await dbUpdateJob(jobId, { status: "running" })

  try {
    // Fetch repo config (.orvitlab.md) and run agent
    const repoConfig = await getRepoConfig(repo, githubToken)
    const raw = await runAgent(command, provider as Provider, apiKey, model, repoConfig)
    const result = JSON.parse(raw)
    const { tokensUsed } = result

    // Run build check on generated files
    const buildResult = await runBuildCheck(result.files)
    await dbUpdateJob(jobId, { build_output: buildResult.output })

    // Run self-review before opening PR
    const review = await reviewOutput(command, result.files, provider, model, apiKey)
    await dbUpdateJob(jobId, { self_review: review.feedback })

    // Create branch and commit files
    await createBranch(repo, result.branch, githubToken)
    for (const file of result.files) {
      await commitFile(repo, result.branch, file.path, file.content, `OrvitLab: ${result.summary}`, githubToken)
    }

    const prUrl = await openPR(repo, result.branch, result.summary, `Created by OrvitLab\n\nCommand: "${command}"`, githubToken)

    // Create thread record for this job
    const { data: thread } = await db
      .from("job_threads")
      .insert({
        user_id: userId,
        repo,
        branch: result.branch,
        original_command: command,
        status: "open",
        iteration_count: 1,
        pr_url: prUrl,
      })
      .select()
      .single()

    await db.from("token_usage").insert({ user_id: userId, job_id: jobId, tokens_used: tokensUsed })
    await dbUpdateJob(jobId, {
      status: "done",
      branch: result.branch,
      pr_url: prUrl,
      tokens_used: tokensUsed,
      thread_id: thread?.id || null,
    })

    await sendNotification(userId, "Job Complete", `PR opened: ${result.summary}`)
  } catch (err: any) {
    await dbUpdateJob(jobId, { status: "failed", error: err.message })
    await sendNotification(userId, "Job Failed", err.message)
  }
}

async function processRepair(bull: BullJob) {
  const {
    iterationId, repairPrompt, repo, branch,
    apiKey, githubToken, userId, provider, model,
    isSoftWarning, softWarningMessage,
  } = bull.data

  await db.from("job_iterations").update({ status: "running" }).eq("id", iterationId)

  try {
    const repoConfig = await getRepoConfig(repo, githubToken)
    const raw = await runAgent(repairPrompt, provider as Provider, apiKey, model, repoConfig)
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim())
    const tokensUsed = result.tokensUsed || 0

    const buildResult = await runBuildCheck(result.files)
    const review = await reviewOutput(repairPrompt, result.files, provider, model, apiKey)

    for (const file of result.files) {
      await commitFile(
        repo, branch, file.path, file.content,
        `OrvitLab repair: ${result.summary}`,
        githubToken
      )
    }

    await db.from("job_iterations").update({
      status: "done",
      tokens_used: tokensUsed,
      self_review: review.feedback,
      build_output: buildResult.output,
    }).eq("id", iterationId)

    const notifBody = isSoftWarning
      ? `${softWarningMessage} — Repair complete: ${result.summary}`
      : `Repair complete: ${result.summary}`

    await sendNotification(userId, "Repair ready", notifBody)
  } catch (err: any) {
    await db.from("job_iterations").update({
      status: "failed",
      error_report: err.message,
    }).eq("id", iterationId)
    await sendNotification(userId, "Repair failed", err.message)
  }
}

export function startWorker(): Worker {
  const worker = new Worker("orvitlab-jobs", processJob, { connection })
  worker.on("error", (err) => console.error("BullMQ worker error:", err.message))
  return worker
}
