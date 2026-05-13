import { Router, Request, Response, NextFunction } from "express"
import { db } from "../db/index"
import config from "../config/index"

const router = Router()

// protect all admin routes with the admin secret header — not user JWT
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-admin-secret"]
  if (secret !== config.adminSecret) {
    return res.status(401).json({ error: "Unauthorized" })
  }
  next()
}

router.get("/stats", requireAdmin, async (_req: Request, res: Response) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()

  const [
    { count: totalUsers },
    { count: freeUsers },
    { count: starterUsers },
    { count: proUsers },
    { count: proApiUsers },
    { count: jobsToday },
    { data: monthlyUsage },
  ] = await Promise.all([
    db.from("users").select("*", { count: "exact", head: true }),
    db.from("users").select("*", { count: "exact", head: true }).eq("tier", "free"),
    db.from("users").select("*", { count: "exact", head: true }).eq("tier", "starter"),
    db.from("users").select("*", { count: "exact", head: true }).eq("tier", "pro"),
    db.from("users").select("*", { count: "exact", head: true }).eq("tier", "pro_api"),
    db.from("jobs").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString()),
    db.from("token_usage").select("tokens_used").gte("created_at", startOfMonth),
  ])

  const tokensThisMonth = (monthlyUsage || []).reduce(
    (sum: number, r: any) => sum + r.tokens_used,
    0
  )
  // ~$3 per 1M tokens (Claude Sonnet rate — update as pricing changes)
  const estimatedCost = (tokensThisMonth / 1_000_000) * 3
  const mrr =
    ((starterUsers as number) * 5) +
    ((proUsers as number) * 10) +
    ((proApiUsers as number) * 25)

  res.json({
    totalUsers,
    freeUsers,
    starterUsers,
    proUsers,
    proApiUsers,
    jobsToday,
    tokensThisMonth,
    estimatedCostThisMonth: estimatedCost.toFixed(2),
    mrr,
    estimatedMargin: (mrr - estimatedCost).toFixed(2),
  })
})

// per-user token usage breakdown — identify heavy pooled-key users
router.get("/costs", requireAdmin, async (_req: Request, res: Response) => {
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString()

  const { data } = await db
    .from("token_usage")
    .select("user_id, tokens_used, users(github_username, tier, api_key)")
    .gte("created_at", startOfMonth)

  // group by user and aggregate
  const byUser: Record<string, any> = {}
  for (const row of data || []) {
    const uid = row.user_id
    if (!byUser[uid]) {
      byUser[uid] = {
        githubUsername: (row as any).users?.github_username,
        tier: (row as any).users?.tier,
        usingPooledKey: !(row as any).users?.api_key,
        tokensUsed: 0,
        jobCount: 0,
      }
    }
    byUser[uid].tokensUsed += row.tokens_used
    byUser[uid].jobCount += 1
  }

  const result = Object.values(byUser)
    .sort((a: any, b: any) => b.tokensUsed - a.tokensUsed)
    .map((row: any) => ({
      ...row,
      estimatedCostUsd: row.usingPooledKey
        ? ((row.tokensUsed / 1_000_000) * 3).toFixed(4)
        : "0.00",
    }))

  res.json(result)
})

// recent jobs across all users
router.get("/jobs", requireAdmin, async (_req: Request, res: Response) => {
  const { data } = await db
    .from("jobs")
    .select("*, users(github_username, tier)")
    .order("created_at", { ascending: false })
    .limit(100)
  res.json(data)
})

export default router
