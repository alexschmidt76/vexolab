import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { getThread, getThreadIterations, requestRepair, resolveThread, abandonThread } from "../jobs/threads"

const router = Router()

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const thread = await getThread(req.params.id)
  if (!thread) return res.status(404).json({ error: "Thread not found" })
  const iterations = await getThreadIterations(req.params.id)
  res.json({ thread, iterations })
})

router.post("/:id/repair", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { errorReport } = req.body
  if (!errorReport) return res.status(400).json({ error: "errorReport is required" })
  try {
    const iteration = await requestRepair(user, req.params.id, errorReport)
    res.status(201).json(iteration)
  } catch (err: any) {
    res.status(400).json({ error: err.message })
  }
})

router.post("/:id/resolve", requireAuth, async (req: Request, res: Response) => {
  await resolveThread(req.params.id)
  res.json({ ok: true })
})

router.post("/:id/abandon", requireAuth, async (req: Request, res: Response) => {
  await abandonThread(req.params.id)
  res.json({ ok: true })
})

export default router
