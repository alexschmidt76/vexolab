import { Job, RunnerType } from "../../shared/types"
import { runAgent } from "../providers/index"
import { createBranch, commitFile, openPR } from "../github/client"
import { db } from "../db/index"

// create a new job and route it to the correct runner based on the user's tier
export async function addJob(
  userId: string,
  command: string,
  repo: string,
  userTier: "free" | "pro",
  userApiKey: string,
  userGithubToken: string
): Promise<Job> {
  const runnerType: RunnerType = userTier === "pro" ? "cloud" : "local"

  // insert the job into the database
  const { data: job } = await db
    .from("jobs")
    .insert({
      user_id: userId,
      command,
      repo,
      status: "pending",
      runner_type: runnerType,
    })
    .select()
    .single()

  // pro users run immediately on the cloud, free users wait for the local runner
  if (runnerType === "cloud") {
    processCloudJob(job.id, command, repo, userApiKey, userGithubToken)
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

// run a job on the cloud server for pro users
async function processCloudJob(
  id: string,
  command: string,
  repo: string,
  apiKey: string,
  githubToken: string
) {
  await updateJob(id, { status: "running" })

  try {
    // run the ai agent and parse the response
    const raw = await runAgent(command, "anthropic", apiKey)
    const clean = raw.replace(/```json|```/g, "").trim()
    const result = JSON.parse(clean)

    // create the branch and commit each file
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

    // open a pull request and mark the job as done
    const prUrl = await openPR(
      repo,
      result.branch,
      result.summary,
      `Created by OrvitLab\n\nCommand: "${command}"`,
      githubToken
    )
    await updateJob(id, { status: "done", branch: result.branch, pr_url: prUrl } as any)
  } catch (err: any) {
    await updateJob(id, { status: "failed", error: err.message })
  }
}
