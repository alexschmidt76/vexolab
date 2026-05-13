import { Router, Request, Response } from "express"
import express from "express"
import { requireAuth } from "../auth/middleware"
import { createCheckoutSession, handleWebhook } from "../stripe/index"

const router = Router()

router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { tier } = req.body

  if (!["starter", "pro", "pro_api"].includes(tier)) {
    return res.status(400).json({ error: "Invalid tier. Must be starter, pro, or pro_api." })
  }

  try {
    const url = await createCheckoutSession(
      user.id,
      `${user.github_username}@users.noreply.github.com`,
      tier
    )
    res.json({ url })
  } catch (err: any) {
    console.error("Stripe checkout error:", err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string
    try {
      await handleWebhook(req.body, sig)
      res.json({ received: true })
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  }
)

export default router
