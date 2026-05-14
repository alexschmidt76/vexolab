import { Router, Request, Response } from "express"
import crypto from "crypto"
import { requireAuth } from "../auth/middleware"
import { db } from "../db/index"

const router = Router()

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { data } = await db
    .from("public_api_keys")
    .select("id, name, last_used_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
  res.json(data || [])
})

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { name } = req.body

  const plainKey = `orvit_${crypto.randomBytes(32).toString("hex")}`
  const keyHash = crypto.createHash("sha256").update(plainKey).digest("hex")

  await db.from("public_api_keys").insert({
    user_id: user.id,
    name: name || "Unnamed key",
    key_hash: keyHash,
  })

  res.status(201).json({
    key: plainKey,
    warning: "Save this key now. It will never be shown again.",
  })
})

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  await db.from("public_api_keys").delete().eq("id", req.params.id).eq("user_id", user.id)
  res.json({ ok: true })
})

export default router
