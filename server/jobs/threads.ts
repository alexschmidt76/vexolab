import { db, camel } from "../db/index"
import { JobThread, JobIteration, User } from "../../shared/types"
import { checkRepairCap } from "./repairCap"
import { checkSpendLimit } from "./spendLimit"
import { jobQueue } from "./bullQueue"

export async function createThread(
  userId: string,
  repo: string,
  branch: string,
  originalCommand: string,
  prUrl: string | null
): Promise<JobThread> {
  const { data } = await db
    .from("job_threads")
    .insert({ user_id: userId, repo, branch, original_command: originalCommand, status: "open", iteration_count: 1, pr_url: prUrl })
    .select()
    .single()
  return camel<JobThread>(data)!
}

export async function getThread(threadId: string): Promise<JobThread | null> {
  const { data } = await db.from("job_threads").select("*").eq("id", threadId).single()
  return camel<JobThread>(data)
}

export async function getThreadIterations(threadId: string): Promise<JobIteration[]> {
  const { data } = await db
    .from("job_iterations")
    .select("*")
    .eq("thread_id", threadId)
    .order("iteration_number", { ascending: true })
  return (data || []).map((r) => camel<JobIteration>(r)!)
}

export async function requestRepair(
  user: User,
  threadId: string,
  errorReport: string
): Promise<JobIteration> {
  const thread = await getThread(threadId)
  if (!thread) throw new Error("Thread not found")
  if (thread.status !== "open") throw new Error("Thread is no longer open")

  const capResult = checkRepairCap(user, thread.iterationCount)
  if (!capResult.allowed) throw new Error(capResult.message!)

  if (user.apiKey) {
    await checkSpendLimit(user.id, user.spendLimitUsd)
  }

  const history = await getThreadIterations(threadId)

  const historyContext = history.map((iter, i) => `
=== Attempt ${i + 1} ===
Command: ${iter.command}
${iter.errorReport ? `Error reported: ${iter.errorReport}` : ""}
${iter.buildOutput ? `Build output: ${iter.buildOutput}` : ""}
${iter.selfReview ? `Self review: ${iter.selfReview}` : ""}
Status: ${iter.status}`).join("\n")

  const repairPrompt = `You are repairing code on branch "${thread.branch}" in repo "${thread.repo}".

Original command: "${thread.originalCommand}"

Previous attempts and their outcomes:
${historyContext}

Latest error reported by user:
${errorReport}

Fix the issues described. Build on the existing branch — do not start from scratch.
Respond ONLY in this exact JSON format:
{
  "branch": "${thread.branch}",
  "summary": "what was fixed",
  "files": [
    { "path": "src/...", "content": "..." }
  ]
}`

  const iterationNumber = thread.iterationCount + 1

  const { data: iteration } = await db
    .from("job_iterations")
    .insert({
      thread_id: threadId,
      job_id: null,
      iteration_number: iterationNumber,
      command: repairPrompt,
      error_report: errorReport,
      status: "pending",
      provider: user.provider,
      model: user.model,
    })
    .select()
    .single()

  await db.from("job_threads").update({ iteration_count: iterationNumber }).eq("id", threadId)

  const apiKey = user.apiKey || ""
  if (!apiKey) throw new Error("No API key available")

  await jobQueue.add("process-repair", {
    iterationId: iteration.id,
    repairPrompt,
    repo: thread.repo,
    branch: thread.branch,
    apiKey,
    githubToken: user.githubToken,
    userId: user.id,
    provider: user.provider,
    model: user.model,
    isSoftWarning: capResult.isSoftWarning,
    softWarningMessage: capResult.message,
  })

  return camel<JobIteration>(iteration)!
}

export async function resolveThread(threadId: string): Promise<void> {
  await db.from("job_threads").update({ status: "resolved" }).eq("id", threadId)
}

export async function abandonThread(threadId: string): Promise<void> {
  await db.from("job_threads").update({ status: "abandoned" }).eq("id", threadId)
}
