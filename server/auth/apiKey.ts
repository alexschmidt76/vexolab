import { Request, Response, NextFunction } from "express"
import crypto from "crypto"
import { db } from "../db/index"
import rateLimit from "express-rate-limit"
import config from "../config/index"

export const publicApiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: config.publicApiRateLimitPerMinute,
  message: { error: "Rate limit exceeded. Max 60 requests per minute." },
})

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-api-key"] as string
  if (!key) return res.status(401).json({ error: "x-api-key header required" })

  const keyHash = crypto.createHash("sha256").update(key).digest("hex")

  const { data: apiKey } = await db
    .from("public_api_keys")
    .select("*, users(*)")
    .eq("key_hash", keyHash)
    .single()

  if (!apiKey) return res.status(401).json({ error: "Invalid API key" })

  await db.from("public_api_keys").update({ last_used_at: new Date() }).eq("id", apiKey.id)

  res.locals.user = apiKey.users
  next()
}
