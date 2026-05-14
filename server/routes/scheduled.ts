import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { db } from "../db/index"
import { describeSchedule, getNextRunTime } from "../jobs/scheduler"
import CronExpressionParser from "cron-parser"

const router = Router()

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { data } = await db
    .from("scheduled_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  res.json(data || [])
})

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { command, repo, cronExpression } = req.body

  if (!command || !repo || !cronExpression) {
    return res.status(400).json({ error: "command, repo, and cronExpression are required" })
  }

  let humanReadable: string
  let nextRunAt: Date
  try {
    CronExpressionParser.parse(cronExpression)
    humanReadable = describeSchedule(cronExpression)
    nextRunAt = getNextRunTime(cronExpression)
  } catch {
    return res.status(400).json({ error: "Invalid cron expression" })
  }

  const { data } = await db
    .from("scheduled_jobs")
    .insert({
      user_id: user.id,
      command,
      repo,
      cron_expression: cronExpression,
      human_readable: humanReadable,
      provider: user.provider || "anthropic",
      model: user.model || "claude-sonnet-4-6",
      enabled: true,
      next_run_at: nextRunAt,
    })
    .select()
    .single()

  res.status(201).json(data)
})

router.patch("/:id/toggle", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { enabled } = req.body
  await db.from("scheduled_jobs").update({ enabled }).eq("id", req.params.id).eq("user_id", user.id)
  res.json({ ok: true })
})

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  await db.from("scheduled_jobs").delete().eq("id", req.params.id).eq("user_id", user.id)
  res.json({ ok: true })
})

export default router
