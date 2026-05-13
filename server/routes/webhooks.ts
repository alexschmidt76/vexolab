import { Router, Request, Response } from "express"
import crypto from "crypto"
import { requireAuth } from "../auth/middleware"
import { addJob } from "../jobs/queue"
import { db } from "../db/index"

const router = Router()

// register a webhook config for a repo
router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { repo, events } = req.body

  if (!repo) return res.status(400).json({ error: "repo is required" })

  const secret = crypto.randomBytes(20).toString("hex")

  const { data } = await db
    .from("webhook_configs")
    .upsert(
      { user_id: user.id, repo, secret, events: events || ["push"] },
      { onConflict: "user_id,repo" }
    )
    .select()
    .single()

  res.json({
    webhookUrl: `${process.env.SERVER_URL}/webhooks/receive/${data.id}`,
    secret: data.secret,
    instructions: "Add this URL and secret to your GitHub repo Settings → Webhooks",
  })
})

// list the authenticated user's webhook configs
router.get("/", requireAuth, async (_req: Request, res: Response) => {
  const user = res.locals.user
  const { data } = await db
    .from("webhook_configs")
    .select("*")
    .eq("user_id", user.id)
  res.json(data)
})

// delete a webhook config
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  await db
    .from("webhook_configs")
    .delete()
    .eq("id", req.params.id)
    .eq("user_id", user.id)
  res.json({ ok: true })
})

// receive an incoming github webhook — raw body is set by index.ts for signature verification
router.post("/receive/:webhookId", async (req: Request, res: Response) => {
  const { webhookId } = req.params

  const { data: webhook } = await db
    .from("webhook_configs")
    .select("*, users(*)")
    .eq("id", webhookId)
    .single()

  if (!webhook) return res.status(404).json({ error: "Webhook not found" })

  // verify github signature using the raw body
  const signature = req.headers["x-hub-signature-256"] as string
  if (!signature) return res.status(401).json({ error: "Missing signature" })

  const rawBody = req.body as Buffer
  const hmac = crypto.createHmac("sha256", webhook.secret)
  const digest = "sha256=" + hmac.update(rawBody).digest("hex")

  if (
    signature.length !== digest.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
  ) {
    return res.status(401).json({ error: "Invalid signature" })
  }

  const event = req.headers["x-github-event"]
  const payload = JSON.parse(rawBody.toString())
  const user = webhook.users

  // build a command from the github event payload
  let command: string | null = null

  if (event === "push") {
    const branch = payload.ref?.replace("refs/heads/", "")
    const commits = (payload.commits || []).map((c: any) => c.message).join(", ")
    if (commits) {
      command = `Review these commits on branch ${branch} and suggest improvements: ${commits}`
    }
  }

  if (event === "pull_request" && payload.action === "opened") {
    command = `Review this PR titled "${payload.pull_request.title}" and add helpful review comments`
  }

  if (!command) return res.json({ ok: true, skipped: true })

  const provider = user.provider || "anthropic"
  const apiKey =
    provider === "anthropic" ? user.api_key :
    provider === "openai" ? user.openai_api_key :
    provider === "gemini" ? user.gemini_api_key :
    null

  await addJob(
    user.id,
    command,
    webhook.repo,
    user.tier,
    provider,
    user.model || "claude-sonnet-4-6",
    apiKey,
    user.github_token,
    "webhook"
  )

  res.json({ ok: true })
})

export default router
