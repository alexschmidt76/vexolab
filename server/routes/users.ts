import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { db } from "../db/index"

const router = Router()

router.get("/me", requireAuth, async (_req: Request, res: Response) => {
  const user = res.locals.user

  // calculate token usage for the current calendar month
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const { data: usage } = await db
    .from("token_usage")
    .select("tokens_used")
    .eq("user_id", user.id)
    .gte("created_at", startOfMonth)

  const tokensThisMonth = (usage || []).reduce(
    (sum: number, row: any) => sum + row.tokens_used,
    0
  )

  // never return sensitive fields to the client
  const { github_token, ...safe } = user
  res.json({ ...safe, tokensThisMonth })
})

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { apiKey, openaiApiKey, geminiApiKey, provider, model } = req.body

  // only update fields that were explicitly sent
  const updates: Record<string, any> = {}
  if (apiKey !== undefined) updates.api_key = apiKey
  if (openaiApiKey !== undefined) updates.openai_api_key = openaiApiKey
  if (geminiApiKey !== undefined) updates.gemini_api_key = geminiApiKey
  if (provider !== undefined) updates.provider = provider
  if (model !== undefined) updates.model = model

  if (Object.keys(updates).length > 0) {
    await db.from("users").update(updates).eq("id", user.id)
  }

  res.json({ ok: true })
})

export default router
