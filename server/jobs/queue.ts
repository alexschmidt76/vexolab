import { Job, RunnerType, UserTier, Provider, JobTrigger } from "../../shared/types"
import { jobQueue } from "./bullQueue"
import { db } from "../db/index"
import config from "../config/index"

// monthly prompt limits per tier
const TIER_LIMITS: Record<string, number> = {
  free: 15,
  starter: 100,
  pro: 500,
  pro_api: Infinity,
}

// resolve which api key to use based on provider and whether the user has their own
function resolveApiKey(provider: Provider, userApiKey: string | null): string {
  if (provider === "ollama") return ""
  if (userApiKey) return userApiKey
  if (provider === "anthropic") return config.anthropicKey
  if (provider === "openai") return config.openaiApiKey
  return ""
}

// create a new job and route it to the correct runner based on provider and tier
export async function addJob(
  userId: string,
  command: string,
  repo: string,
  userTier: UserTier,
  provider: Provider,
  model: string,
  userApiKey: string | null,
  userGithubToken: string,
  trigger: JobTrigger = "manual"
): Promise<Job> {
  // enforce monthly prompt limits
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { count } = await db
    .from("jobs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth)

  const limit = TIER_LIMITS[userTier] ?? 15
  if ((count ?? 0) >= limit) {
    throw new Error(`Monthly limit of ${limit} jobs reached. Upgrade to continue.`)
  }

  // ollama must always run locally; free tier → local; otherwise cloud
  const runnerType: RunnerType =
    provider === "ollama" || userTier === 'free' ? 'local' : 'cloud'

  const { data: job } = await db
    .from("jobs")
    .insert({
      user_id: userId,
      command,
      repo,
      status: "pending",
      runner_type: runnerType,
      trigger,
      provider,
      model,
    })
    .select()
    .single()

  // cloud jobs go into the BullMQ queue; local jobs wait for the runner to poll
  if (runnerType === "cloud") {
    const apiKey = resolveApiKey(provider, userApiKey)
    await jobQueue.add("process-job", {
      jobId: job.id,
      command,
      repo,
      apiKey,
      githubToken: userGithubToken,
      userId,
      provider,
      model,
    })
  }

  return job
}

// get a single job by id
export async function getJob(id: string): Promise<Job | null> {
  const { data } = await db.from("jobs").select("*").eq("id", id).single()
  return data
}

// get the oldest pending local job for a user
export async function getNextLocalJob(userId: string): Promise<Job | null> {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("runner_type", "local")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
  return data || null
}

// update a job's fields in the database
export async function updateJob(id: string, updates: Partial<Job>) {
  await db.from("jobs").update(updates).eq("id", id)
}

// get the most recent 50 jobs for a user
export async function getUserJobs(userId: string): Promise<Job[]> {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
  return data || []
}
