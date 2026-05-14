import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { db } from "../db/index"
import { MODEL_COSTS } from "../../shared/types"

const router = Router()

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null
  return `${key.slice(0, 8)}••••••••`
}

router.get("/me", requireAuth, async (_req: Request, res: Response) => {
  const user = res.locals.user
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const { data: usage } = await db
    .from("token_usage")
    .select("tokens_used")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth)

  const tokensThisMonth = (usage || []).reduce(
    (sum: number, row: any) => sum + row.tokens_used, 0
  )

  const { data: jobUsage } = await db
    .from("jobs")
    .select("tokens_used, model")
    .eq("user_id", user.id)
    .eq("status", "done")
    .not("tokens_used", "is", null)
    .gte("created_at", startOfMonth)

  const estimatedSpendUsd = parseFloat(
    (jobUsage || []).reduce((sum: number, job: any) => {
      const costPer1M = MODEL_COSTS[job.model] ?? 0
      return sum + (job.tokens_used / 1_000_000) * costPer1M
    }, 0).toFixed(4)
  )

  res.json({
    id: user.id,
    githubUsername: user.github_username,
    tier: user.tier,
    provider: user.provider || "anthropic",
    model: user.model || "claude-sonnet-4-6",
    freePromptsRemaining: user.free_prompts_remaining ?? 50,
    spendLimitUsd: user.spend_limit_usd ?? null,
    spendStatus: null,
    tokensThisMonth,
    estimatedSpendUsd,
    jobsThisMonth: 0,
    apiKey: maskKey(user.api_key),
    openaiApiKey: maskKey(user.openai_api_key),
    geminiApiKey: maskKey(user.gemini_api_key),
    hasAnthropicKey: !!user.api_key,
    hasOpenAiKey: !!user.openai_api_key,
    hasGeminiKey: !!user.gemini_api_key,
  })
})

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { apiKey, openaiApiKey, geminiApiKey, provider, model, spendLimitUsd } = req.body

  if (spendLimitUsd !== undefined && spendLimitUsd !== null) {
    if (typeof spendLimitUsd !== "number" || spendLimitUsd < 0) {
      return res.status(400).json({ error: "spendLimitUsd must be a positive number or null" })
    }
  }

  const updates: Record<string, any> = {}
  if (apiKey !== undefined) updates.api_key = apiKey
  if (openaiApiKey !== undefined) updates.openai_api_key = openaiApiKey
  if (geminiApiKey !== undefined) updates.gemini_api_key = geminiApiKey
  if (provider !== undefined) updates.provider = provider
  if (model !== undefined) updates.model = model
  if (spendLimitUsd !== undefined) updates.spend_limit_usd = spendLimitUsd

  if (Object.keys(updates).length > 0) {
    await db.from("users").update(updates).eq("id", user.id)
  }

  res.json({ ok: true })
})

router.post("/me/logout", requireAuth, (_req: Request, res: Response) => {
  res.json({ ok: true })
})

router.patch("/me/spend-limit", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { limitUsd } = req.body

  if (limitUsd !== null && (typeof limitUsd !== "number" || limitUsd < 0)) {
    return res.status(400).json({ error: "limitUsd must be a positive number or null" })
  }

  await db.from("users").update({ spend_limit_usd: limitUsd }).eq("id", user.id)
  res.json({ ok: true, limitUsd })
})

router.patch("/me/notifications", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { slackWebhookUrl, discordWebhookUrl } = req.body

  const updates: Record<string, any> = {}
  if (slackWebhookUrl !== undefined) updates.slack_webhook_url = slackWebhookUrl
  if (discordWebhookUrl !== undefined) updates.discord_webhook_url = discordWebhookUrl

  if (Object.keys(updates).length > 0) {
    await db.from("users").update(updates).eq("id", user.id)
  }

  res.json({ ok: true })
})

export default router
