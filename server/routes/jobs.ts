import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { addJob, getJob } from "../jobs/queue"

const router = Router()

// create a new job for the authenticated user
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const { command, repo } = req.body
  const user = res.locals.user

  if (!command || !repo) {
    return res.status(400).json({ error: "command and repo are required" })
  }

  // require the user to have saved their api key before running a job
  if (!user.api_key) {
    return res.status(400).json({ error: "API key not configured. Add it in settings." })
  }

  // route the job to cloud or local runner based on the user's tier
  const job = await addJob(
    user.id,
    command,
    repo,
    user.tier,
    user.api_key,
    user.github_token
  )

  res.status(201).json(job)
})

// get the status of a job by id
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const job = await getJob(req.params.id as string)
  if (!job) return res.status(404).json({ error: "Job not found" })
  res.json(job)
})

export default router
