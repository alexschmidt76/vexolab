import { Router, Request, Response, NextFunction } from "express"
import { requireAuth } from "../auth/middleware"
import { getNextLocalJob, updateJob } from "../jobs/queue"
import { db } from "../db/index"
import crypto from "crypto"

const router = Router()

// verify the runner token and attach the user id to the request
async function requireRunnerToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  const token = authHeader.split(" ")[1]

  // look up the token in the database to find the associated user
  const { data } = await db.from("runner_tokens").select("user_id").eq("token", token).single()
  if (!data) return res.status(401).json({ error: "Invalid runner token" })
  res.locals.userId = data.user_id
  next()
}

// generate a new runner token for the user — requires user jwt
router.post("/token", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const token = crypto.randomBytes(32).toString("hex")

  // replace any existing token with a fresh one
  await db.from("runner_tokens").delete().eq("user_id", user.id)
  await db.from("runner_tokens").insert({ user_id: user.id, token })

  res.json({ token })
})

// local runner polls this to get the next pending job
router.get("/next", requireRunnerToken, async (_req: Request, res: Response) => {
  const job = await getNextLocalJob(res.locals.userId)
  res.json({ job: job || null })
})

// local runner posts results back here when a job finishes
router.post("/complete", requireRunnerToken, async (req: Request, res: Response) => {
  const { jobId, status, branch, prUrl, error } = req.body
  await updateJob(jobId, {
    status,
    branch: branch || null,
    pr_url: prUrl || null,
    error: error || null,
  } as any)
  res.json({ ok: true })
})

export default router
