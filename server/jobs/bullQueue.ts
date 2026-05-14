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

export const jobQueue = new Queue("vexolab-jobs", { connection })
jobQueue.on("error", (err) => console.error("BullMQ queue error:", err.message))

async function dbUpdateJob(id: string, updates: Record<string, any>) {
  const { error } = await db.from("jobs").update(updates).eq("id", id)
  if (error) console.error(`[db] update failed for job ${id}:`, error.message, updates)
}

async function processJob(bull: BullJob) {
  if (bull.name === "process-repair") {
    return processRepair(bull)
  }

  const { jobId, command, repo, apiKey, githubToken, userId, provider, model } = bull.data
  console.log(`[job ${jobId}] starting — repo=${repo} provider=${provider} model=${model}`)
  await dbUpdateJob(jobId, { status: "running" })

  try {
    console.log(`[job ${jobId}] fetching repo config`)
    const repoConfig = await getRepoConfig(repo, githubToken)

    console.log(`[job ${jobId}] running agent`)
    const raw = await runAgent(command, provider as Provider, apiKey, model, repoConfig)
    const result = JSON.parse(raw)
    const { tokensUsed } = result
    console.log(`[job ${jobId}] agent done — branch=${result.branch} files=${result.files?.length ?? 0} tokens=${tokensUsed}`)

    console.log(`[job ${jobId}] running build check`)
    const buildResult = await runBuildCheck(result.files)
    await dbUpdateJob(jobId, { build_output: buildResult.output })
    console.log(`[job ${jobId}] build check done — passed=${buildResult.passed}`)

    console.log(`[job ${jobId}] running self-review`)
    const review = await reviewOutput(command, result.files, provider, model, apiKey)
    await dbUpdateJob(jobId, { self_review: review.feedback })
    console.log(`[job ${jobId}] self-review done — approved=${review.approved}`)

    console.log(`[job ${jobId}] creating branch and committing files`)
    await createBranch(repo, result.branch, githubToken)
    for (const file of result.files) {
      await commitFile(repo, result.branch, file.path, file.content, `VexoLab: ${result.summary}`, githubToken)
    }

    const prUrl = await openPR(repo, result.branch, result.summary, `Created by VexoLab\n\nCommand: "${command}"`, githubToken)
    console.log(`[job ${jobId}] PR opened — ${prUrl}`)

    const { data: thread, error: threadError } = await db
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
    if (threadError) console.error(`[job ${jobId}] thread insert error:`, threadError.message)

    const { error: tokenError } = await db.from("token_usage").insert({ user_id: userId, job_id: jobId, tokens_used: tokensUsed })
    if (tokenError) console.error(`[job ${jobId}] token_usage insert error:`, tokenError.message)

    await dbUpdateJob(jobId, {
      status: "done",
      branch: result.branch,
      pr_url: prUrl,
      tokens_used: tokensUsed,
      thread_id: thread?.id || null,
    })
    console.log(`[job ${jobId}] done`)

    await sendNotification(userId, "Job Complete", `PR opened: ${result.summary}`)
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error(`[job ${jobId}] failed:`, message)
    await dbUpdateJob(jobId, { status: "failed", error: message })
    await sendNotification(userId, "Job Failed", message)
  }
}

async function processRepair(bull: BullJob) {
  const {
    iterationId, repairPrompt, repo, branch,
    apiKey, githubToken, userId, provider, model,
    isSoftWarning, softWarningMessage,
  } = bull.data

  console.log(`[repair ${iterationId}] starting — repo=${repo} branch=${branch}`)
  const { error: startError } = await db.from("job_iterations").update({ status: "running" }).eq("id", iterationId)
  if (startError) console.error(`[repair ${iterationId}] status update error:`, startError.message)

  try {
    const repoConfig = await getRepoConfig(repo, githubToken)

    console.log(`[repair ${iterationId}] running agent`)
    const raw = await runAgent(repairPrompt, provider as Provider, apiKey, model, repoConfig)
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim())
    const tokensUsed = result.tokensUsed || 0
    console.log(`[repair ${iterationId}] agent done — files=${result.files?.length ?? 0}`)

    const buildResult = await runBuildCheck(result.files)
    const review = await reviewOutput(repairPrompt, result.files, provider, model, apiKey)

    for (const file of result.files) {
      await commitFile(
        repo, branch, file.path, file.content,
        `VexoLab repair: ${result.summary}`,
        githubToken
      )
    }

    const { error: doneError } = await db.from("job_iterations").update({
      status: "done",
      tokens_used: tokensUsed,
      self_review: review.feedback,
      build_output: buildResult.output,
    }).eq("id", iterationId)
    if (doneError) console.error(`[repair ${iterationId}] done update error:`, doneError.message)
    console.log(`[repair ${iterationId}] done`)

    const notifBody = isSoftWarning
      ? `${softWarningMessage} — Repair complete: ${result.summary}`
      : `Repair complete: ${result.summary}`

    await sendNotification(userId, "Repair ready", notifBody)
  } catch (err: any) {
    const message = err?.message || String(err)
    console.error(`[repair ${iterationId}] failed:`, message)
    const { error: failError } = await db.from("job_iterations").update({
      status: "failed",
      error_report: message,
    }).eq("id", iterationId)
    if (failError) console.error(`[repair ${iterationId}] fail update error:`, failError.message)
    await sendNotification(userId, "Repair failed", message)
  }
}

export function startWorker(): Worker {
  const worker = new Worker("vexolab-jobs", processJob, {
    connection,
    lockDuration: 10 * 60 * 1000, // 10 minutes — AI jobs can be slow
  })
  worker.on("error", (err) => console.error("BullMQ worker error:", err.message))
  return worker
}
