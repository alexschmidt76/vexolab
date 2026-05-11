import { Router, Request, Response } from "express"
import { addJob, getJob } from "../jobs/queue"

const router = Router()

router.post("/", async (req: Request, res: Response) => {
  const { command, repo } = req.body
  if (!command || !repo) {
    return res.status(400).json({ error: "command and repo are required" })
  }
  const job = await addJob(command, repo)
  res.status(201).json(job)
})

router.get("/:id", (req: Request, res: Response) => {
  const job = getJob(req.params.id as string)
  if (!job) return res.status(404).json({ error: "Job not found" })
  res.json(job)
})

export default router
