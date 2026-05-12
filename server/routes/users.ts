import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { db } from "../db/index"

const router = Router()

router.get("/me", requireAuth, (req: Request, res: Response) => {
  const user = res.locals.user
  // Never return sensitive fields to the client
  const { github_token, ...safe } = user
  res.json(safe)
})

router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { apiKey } = req.body

  await db
    .from("users")
    .update({ api_key: apiKey })
    .eq("id", user.id)

  res.json({ ok: true })
})

export default router
