import { Router, Request, Response } from "express"
import { requireApiKey, publicApiRateLimit } from "../auth/apiKey"
import { addJob, getJob } from "../jobs/queue"
import { Provider } from "../../shared/types"

const router = Router()
router.use(publicApiRateLimit)
router.use(requireApiKey)

router.post("/jobs", async (req: Request, res: Response) => {
  const user = res.locals.user
  const { command, repo, provider, model } = req.body

  if (!command || !repo) {
    return res.status(400).json({ error: "command and repo are required" })
  }

  const resolvedProvider: Provider = provider || user.provider || "anthropic"
  const apiKey =
    resolvedProvider === "anthropic" ? user.api_key :
    resolvedProvider === "openai" ? user.openai_api_key :
    resolvedProvider === "gemini" ? user.gemini_api_key :
    null

  try {
    const job = await addJob(
      user.id, command, repo, user.tier, "cloud",
      resolvedProvider, model || user.model || "claude-sonnet-4-6",
      apiKey, user.github_token, "cli"
    )
    res.status(201).json(job)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.get("/jobs/:id", async (req: Request, res: Response) => {
  const job = await getJob(req.params.id)
  if (!job) return res.status(404).json({ error: "Not found" })
  res.json(job)
})

export default router
