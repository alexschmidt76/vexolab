import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { addJob, getJob, getUserJobs, deleteJob } from "../jobs/queue"
import { Provider, PROVIDER_MODELS } from "../../shared/types"

const router = Router()

// create a new job for the authenticated user
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { command, repo, provider, model, runnerType } = req.body
  const user = res.locals.user

  if (!command || !repo) {
    return res.status(400).json({ error: "command and repo are required" })
  }

  const resolvedProvider: Provider = provider || user.provider || "anthropic"

  // resolve the right api key for the chosen provider
  const apiKey =
    resolvedProvider === "anthropic" ? user.api_key :
    resolvedProvider === "openai" ? user.openai_api_key :
    resolvedProvider === "gemini" ? user.gemini_api_key :
    null  // ollama: no key needed

  const resolvedModel = model || user.model || PROVIDER_MODELS[resolvedProvider][0].id

  try {
    const job = await addJob(
      user.id,
      command,
      repo,
      user.tier,
      runnerType,
      resolvedProvider,
      resolvedModel,
      apiKey,
      user.github_token
    )
    res.status(201).json(job)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

// get recent job history for the authenticated user
router.get("/", requireAuth, async (_req: Request, res: Response) => {
  const user = res.locals.user
  const jobs = await getUserJobs(user.id)
  res.json(jobs)
})

// get the status of a job by id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const job = await getJob(req.params.id as string)
  if (!job) return res.status(404).json({ error: "Job not found" })
  res.json(job)
})

// delete a pending or failed job
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const deleted = await deleteJob(req.params.id as string)
  if (!deleted) return res.status(400).json({ error: "Job not found or not deletable" })
  res.json({ ok: true })
})

// retry a failed job by creating a new one with the same params
router.post("/:id/retry", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const original = await getJob(req.params.id as string)
  if (!original) return res.status(404).json({ error: "Job not found" })
  if (original.status !== "failed" && original.status !== "pending") {
    return res.status(400).json({ error: "Only failed or pending jobs can be retried" })
  }

  const resolvedProvider = (original.provider as Provider) || user.provider || "anthropic"
  const apiKey =
    resolvedProvider === "anthropic" ? user.api_key :
    resolvedProvider === "openai" ? user.openai_api_key :
    resolvedProvider === "gemini" ? user.gemini_api_key :
    null

  try {
    const job = await addJob(
      user.id,
      original.command,
      original.repo,
      user.tier,
      original.runnerType,
      resolvedProvider,
      original.model,
      apiKey,
      user.github_token
    )
    res.status(201).json(job)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

export default router
