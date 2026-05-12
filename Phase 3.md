# OrvitLab — Phase 3 Agent Instructions
> Read this entire file before writing any code. This builds directly on top of Phase 2. Assume everything in Phase 1 and Phase 2 is already built and working.

---

## What Already Exists (Phases 1 & 2)
- `shared/types.ts` — Job, JobStatus, Provider, RunnerType, UserTier, User types
- `server/auth/` — GitHub OAuth, JWT middleware
- `server/config/index.ts` — all env vars
- `server/db/index.ts` — Supabase client
- `server/stripe/index.ts` — checkout, webhook handling
- `server/providers/` — Anthropic provider abstraction
- `server/github/client.ts` — branch, commit, PR (token per request)
- `server/jobs/queue.ts` — job routing (local vs cloud), Supabase persistence
- `server/routes/` — jobs, billing, runner
- `server/index.ts` — Express server
- `runner/index.ts` — local runner CLI
- `mobile/app/` — auth, home, settings screens with NativeWind

---

## What You Are Building in Phase 3
1. **Three tier system** — Free, Pro, Pro+API with token pool
2. **Token pool** — OrvitLab-managed Anthropic API key for Pro+API users
3. **Token usage tracking** — per-user monthly token consumption
4. **Token limit enforcement** — hard cap with graceful failure
5. **BullMQ + Redis** — replace direct async processing with proper job queue
6. **Push notifications** — notify user when job completes or fails
7. **Free trial** — 5 job limit on free tier before requiring upgrade
8. **Web dashboard** — React JS + Tailwind + shadcn/ui
9. **Deploy to Railway** — production backend deployment
10. **Local runner as desktop app** — package runner with Electron

---

## Rules to Follow
- All existing rules from Phases 1 and 2 still apply
- Never expose the pooled Anthropic API key to clients — server only
- Always calculate token usage server-side — never trust client-reported usage
- Token limits must be enforced in the queue before a job starts, not after
- BullMQ workers must handle their own errors and update job status on failure
- Web dashboard must use the same REST API as the mobile app — no shortcuts
- Free trial limit is enforced by job count in database, not client state
- Pro+API tier users still get cloud runner — token pool is additive, not separate

---

## New Environment Variables

Add to `.env` and `.env.example`:

```bash
# Token pool (OrvitLab's own Anthropic key for Pro+API users)
POOL_ANTHROPIC_API_KEY=your_pooled_anthropic_api_key

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Stripe — new price ID for Pro+API tier
STRIPE_PRO_API_PRICE_ID=your_stripe_price_id_for_pro_api_plan

# Push notifications (Expo)
EXPO_ACCESS_TOKEN=your_expo_access_token

# Monthly token limit for Pro+API users
POOL_MONTHLY_TOKEN_LIMIT=1000000

# Free trial job limit
FREE_TRIAL_JOB_LIMIT=5

# Web dashboard URL (for CORS)
DASHBOARD_URL=http://localhost:5173
```

---

## Step 1 — Update Shared Types

Replace `shared/types.ts` entirely:

```ts
// shared/types.ts

export type JobStatus = "pending" | "running" | "done" | "failed"
export type Provider = "anthropic" | "openai" | "gemini"
export type RunnerType = "local" | "cloud"
export type UserTier = "free" | "pro" | "pro_api"

export type Job = {
  id: string
  userId: string
  command: string
  repo: string
  status: JobStatus
  runnerType: RunnerType
  branch: string | null
  prUrl: string | null
  error: string | null
  tokensUsed: number | null
  createdAt: Date
  updatedAt: Date
}

export type User = {
  id: string
  githubId: string
  githubUsername: string
  githubToken: string
  tier: UserTier
  provider: Provider
  apiKey: string | null
  stripeCustomerId: string | null
  expoPushToken: string | null
  jobsThisMonth: number
  tokensThisMonth: number
  createdAt: Date
}

export type TokenUsage = {
  userId: string
  month: string       // "2026-05"
  tokensUsed: number
  jobCount: number
}
```

---

## Step 2 — Supabase Migrations

Run these in the Supabase SQL editor:

```sql
-- Add new columns to users
alter table users
  add column if not exists tier text not null default 'free',
  add column if not exists expo_push_token text,
  add column if not exists jobs_this_month int not null default 0,
  add column if not exists tokens_this_month int not null default 0;

-- Add tokens_used to jobs
alter table jobs
  add column if not exists tokens_used int;

-- Token usage tracking table
create table if not exists token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  month text not null,            -- "2026-05"
  tokens_used int not null default 0,
  job_count int not null default 0,
  unique(user_id, month)
);

-- Reset monthly counters on the 1st of each month
-- (Run this as a Supabase cron job or handle in server)
create or replace function reset_monthly_counters()
returns void as $$
begin
  update users set tokens_this_month = 0, jobs_this_month = 0;
end;
$$ language plpgsql;
```

---

## Step 3 — Update Config

Add new fields to `server/config/index.ts`:

```ts
// server/config/index.ts
import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

export default {
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  poolAnthropicKey: process.env.POOL_ANTHROPIC_API_KEY!,
  githubToken: process.env.GITHUB_TOKEN!,
  githubUsername: process.env.GITHUB_USERNAME!,
  githubClientId: process.env.GITHUB_CLIENT_ID!,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET!,
  jwtSecret: process.env.JWT_SECRET!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID!,
  stripeProApiPriceId: process.env.STRIPE_PRO_API_PRICE_ID!,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN!,
  poolMonthlyTokenLimit: parseInt(process.env.POOL_MONTHLY_TOKEN_LIMIT || "1000000"),
  freeTrialJobLimit: parseInt(process.env.FREE_TRIAL_JOB_LIMIT || "5"),
  dashboardUrl: process.env.DASHBOARD_URL || "http://localhost:5173",
  port: process.env.PORT || 3000,
}
```

---

## Step 4 — BullMQ Job Queue

### Install Redis and BullMQ:
```bash
cd server
npm install bullmq ioredis
```

Install Redis locally for development:
```bash
# Mac
brew install redis && brew services start redis

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

### Create BullMQ queue:
```ts
// server/jobs/bullQueue.ts
import { Queue, Worker, Job as BullJob } from "bullmq"
import IORedis from "ioredis"
import config from "../config/index"
import { runAgent } from "../providers/index"
import { createBranch, commitFile, openPR } from "../github/client"
import { db } from "../db/index"
import { sendPushNotification } from "../notifications/index"

const connection = new IORedis(config.redisUrl, { maxRetriesPerRequest: null })

export const jobQueue = new Queue("orvitlab-jobs", { connection })

// Worker processes jobs from the queue
export const jobWorker = new Worker(
  "orvitlab-jobs",
  async (bullJob: BullJob) => {
    const { jobId, command, repo, apiKey, githubToken, userId } = bullJob.data

    await db.from("jobs").update({ status: "running" }).eq("id", jobId)

    try {
      const raw = await runAgent(command, "anthropic", apiKey)
      const clean = raw.replace(/```json|```/g, "").trim()
      const result = JSON.parse(clean)

      // Count tokens if using pooled key
      const tokensUsed = result.tokensUsed || 0
      if (tokensUsed > 0) {
        await trackTokenUsage(userId, tokensUsed)
      }

      await createBranch(repo, result.branch, githubToken)

      for (const file of result.files) {
        await commitFile(
          repo, result.branch, file.path, file.content,
          `OrvitLab: ${result.summary}`, githubToken
        )
      }

      const prUrl = await openPR(
        repo, result.branch, result.summary,
        `Created by OrvitLab\n\nCommand: "${command}"`, githubToken
      )

      await db.from("jobs").update({
        status: "done",
        branch: result.branch,
        pr_url: prUrl,
        tokens_used: tokensUsed,
      }).eq("id", jobId)

      await sendPushNotification(
        userId,
        "Job complete ✅",
        `PR ready: ${result.summary}`
      )
    } catch (err: any) {
      await db.from("jobs").update({
        status: "failed",
        error: err.message,
      }).eq("id", jobId)

      await sendPushNotification(
        userId,
        "Job failed ❌",
        err.message
      )
    }
  },
  { connection }
)

async function trackTokenUsage(userId: string, tokens: number) {
  const month = new Date().toISOString().slice(0, 7) // "2026-05"

  await db.from("token_usage").upsert(
    {
      user_id: userId,
      month,
      tokens_used: tokens,
      job_count: 1,
    },
    {
      onConflict: "user_id,month",
    }
  )

  await db.rpc("increment_token_usage", {
    p_user_id: userId,
    p_tokens: tokens,
  })
}
```

---

## Step 5 — Update Provider to Return Token Count

```ts
// server/providers/anthropic.ts
import Anthropic from "@anthropic-ai/sdk"

export async function runAgent(
  command: string,
  apiKey: string
): Promise<{ text: string; tokensUsed: number }> {
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: `You are an AI developer agent. When given a command:
1. Describe what files to create or modify
2. Output the actual code changes
3. Suggest a git branch name (kebab-case, no spaces)

Respond ONLY in this exact JSON format with no extra text:
{
  "branch": "feature/branch-name",
  "summary": "what this change does",
  "files": [
    { "path": "src/components/Example.tsx", "content": "..." }
  ]
}`,
    messages: [{ role: "user", content: command }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens

  return { text, tokensUsed }
}
```

```ts
// server/providers/index.ts
import { runAgent as anthropicAgent } from "./anthropic"
import { Provider } from "../../shared/types"

export async function runAgent(
  command: string,
  provider: Provider = "anthropic",
  apiKey: string
): Promise<string> {
  switch (provider) {
    case "anthropic": {
      const { text, tokensUsed } = await anthropicAgent(command, apiKey)
      // Embed tokensUsed in the JSON response for the queue worker to extract
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
      return JSON.stringify({ ...parsed, tokensUsed })
    }
    // case "openai": return openaiAgent(command, apiKey)
    // case "gemini": return geminiAgent(command, apiKey)
    default: {
      const { text, tokensUsed } = await anthropicAgent(command, apiKey)
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
      return JSON.stringify({ ...parsed, tokensUsed })
    }
  }
}
```

---

## Step 6 — Update Job Queue with Tier Routing + Limits

Replace `server/jobs/queue.ts`:

```ts
// server/jobs/queue.ts
import { Job, RunnerType, UserTier } from "../../shared/types"
import { db } from "../db/index"
import { jobQueue } from "./bullQueue"
import config from "../config/index"

export async function addJob(
  userId: string,
  command: string,
  repo: string,
  userTier: UserTier,
  userApiKey: string | null,
  userGithubToken: string
): Promise<Job> {

  // Enforce free trial job limit
  if (userTier === "free") {
    const { count } = await db
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)

    if ((count || 0) >= config.freeTrialJobLimit) {
      throw new Error(`Free trial limit reached (${config.freeTrialJobLimit} jobs). Upgrade to Pro to continue.`)
    }
  }

  // Enforce Pro+API monthly token limit
  if (userTier === "pro_api") {
    const month = new Date().toISOString().slice(0, 7)
    const { data: usage } = await db
      .from("token_usage")
      .select("tokens_used")
      .eq("user_id", userId)
      .eq("month", month)
      .single()

    if ((usage?.tokens_used || 0) >= config.poolMonthlyTokenLimit) {
      throw new Error("Monthly token limit reached. Your limit resets on the 1st of next month.")
    }
  }

  // Determine runner type and API key to use
  const runnerType: RunnerType = userTier === "free" ? "local" : "cloud"
  const apiKey = userTier === "pro_api"
    ? config.poolAnthropicKey   // Use OrvitLab's pooled key
    : userApiKey                // Use user's own key

  if (!apiKey) {
    throw new Error("No API key configured. Add your Anthropic API key in settings.")
  }

  // Create job in database
  const { data: job } = await db
    .from("jobs")
    .insert({
      user_id: userId,
      command,
      repo,
      status: "pending",
      runner_type: runnerType,
    })
    .select()
    .single()

  // Queue cloud jobs via BullMQ
  if (runnerType === "cloud") {
    await jobQueue.add("process-job", {
      jobId: job.id,
      command,
      repo,
      apiKey,
      githubToken: userGithubToken,
      userId,
    })
  }
  // Local jobs sit as "pending" — local runner polls and picks them up

  return job
}

export async function getJob(id: string): Promise<Job | null> {
  const { data } = await db.from("jobs").select("*").eq("id", id).single()
  return data
}

export async function getUserJobs(userId: string): Promise<Job[]> {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)
  return data || []
}

export async function getNextLocalJob(userId: string): Promise<Job | null> {
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .eq("runner_type", "local")
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
  return data || null
}

export async function updateJob(id: string, updates: Partial<Job>) {
  await db.from("jobs").update(updates).eq("id", id)
}
```

---

## Step 7 — Push Notifications

### Install Expo notifications server SDK:
```bash
cd server
npm install expo-server-sdk
```

```ts
// server/notifications/index.ts
import Expo from "expo-server-sdk"
import { db } from "../db/index"

const expo = new Expo()

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
): Promise<void> {
  const { data: user } = await db
    .from("users")
    .select("expo_push_token")
    .eq("id", userId)
    .single()

  if (!user?.expo_push_token) return
  if (!Expo.isExpoPushToken(user.expo_push_token)) return

  try {
    await expo.sendPushNotificationsAsync([
      {
        to: user.expo_push_token,
        title,
        body,
        sound: "default",
      },
    ])
  } catch (err) {
    console.error("Push notification failed:", err)
    // Non-fatal — don't throw
  }
}
```

### Add push token route:
```ts
// Add to server/routes/runner.ts

router.post("/push-token", requireAuth, async (req: Request, res: Response) => {
  const { token } = req.body
  const user = res.locals.user

  await db.from("users").update({ expo_push_token: token }).eq("id", user.id)
  res.json({ ok: true })
})
```

---

## Step 8 — Update Stripe for Three Tiers

Update `server/stripe/index.ts`:

```ts
// server/stripe/index.ts
import Stripe from "stripe"
import config from "../config/index"
import { db } from "../db/index"
import { UserTier } from "../../shared/types"

const stripe = new Stripe(config.stripeSecretKey)

function priceToTier(priceId: string): UserTier {
  if (priceId === config.stripeProPriceId) return "pro"
  if (priceId === config.stripeProApiPriceId) return "pro_api"
  return "free"
}

export async function createCheckoutSession(
  userId: string,
  tier: "pro" | "pro_api"
): Promise<string> {
  const priceId = tier === "pro_api"
    ? config.stripeProApiPriceId
    : config.stripeProPriceId

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `orvitlab://upgrade?success=true`,
    cancel_url: `orvitlab://upgrade?success=false`,
    metadata: { userId },
  })

  return session.url!
}

export async function handleWebhook(
  payload: Buffer,
  signature: string
): Promise<void> {
  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    config.stripeWebhookSecret
  )

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
    const priceId = lineItems.data[0]?.price?.id
    const tier = priceId ? priceToTier(priceId) : "pro"

    if (userId) {
      await db.from("users").update({
        tier,
        stripe_customer_id: session.customer,
      }).eq("id", userId)
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription
    await db.from("users")
      .update({ tier: "free" })
      .eq("stripe_customer_id", subscription.customer)
  }

  // Handle plan changes (upgrade/downgrade)
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription
    const priceId = subscription.items.data[0]?.price?.id
    const tier = priceId ? priceToTier(priceId) : "pro"

    await db.from("users")
      .update({ tier })
      .eq("stripe_customer_id", subscription.customer)
  }
}
```

### Update billing route to support tier selection:
```ts
// server/routes/billing.ts
router.post("/checkout", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { tier } = req.body  // "pro" or "pro_api"

  if (!["pro", "pro_api"].includes(tier)) {
    return res.status(400).json({ error: "Invalid tier" })
  }

  const url = await createCheckoutSession(user.id, tier)
  res.json({ url })
})
```

---

## Step 9 — Update Jobs Route

Add job history endpoint to `server/routes/jobs.ts`:

```ts
// Add to server/routes/jobs.ts

// GET /jobs — list user's recent jobs
router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const jobs = await getUserJobs(user.id)
  res.json(jobs)
})
```

---

## Step 10 — Add Users Route

```ts
// server/routes/users.ts
import { Router, Request, Response } from "express"
import { requireAuth } from "../auth/middleware"
import { db } from "../db/index"

const router = Router()

// GET /users/me — get current user profile + usage
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const month = new Date().toISOString().slice(0, 7)

  const { data: usage } = await db
    .from("token_usage")
    .select("tokens_used, job_count")
    .eq("user_id", user.id)
    .eq("month", month)
    .single()

  res.json({
    id: user.id,
    githubUsername: user.github_username,
    tier: user.tier,
    tokensThisMonth: usage?.tokens_used || 0,
    jobsThisMonth: usage?.job_count || 0,
    tokenLimit: user.tier === "pro_api" ? parseInt(process.env.POOL_MONTHLY_TOKEN_LIMIT || "1000000") : null,
  })
})

// PATCH /users/me — update settings
router.patch("/me", requireAuth, async (req: Request, res: Response) => {
  const user = res.locals.user
  const { apiKey, provider } = req.body

  await db.from("users").update({
    ...(apiKey !== undefined && { api_key: apiKey }),
    ...(provider !== undefined && { provider }),
  }).eq("id", user.id)

  res.json({ ok: true })
})

export default router
```

---

## Step 11 — Web Dashboard

### Setup:
```bash
cd ../
npm create vite@latest dashboard -- --template react-ts
cd dashboard
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install axios @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react
npx shadcn-ui@latest init
```

Configure `tailwind.config.js`:
```js
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0f0f0f",
          surface: "#1a1a1a",
          accent: "#6366f1",
          text: "#f4f4f5",
          muted: "#71717a",
        },
      },
    },
  },
}
```

### Dashboard structure:
```
dashboard/
├── src/
│   ├── api/
│   │   └── client.ts         # axios instance with auth header
│   ├── components/
│   │   ├── JobCard.tsx        # single job display
│   │   ├── JobList.tsx        # list of recent jobs
│   │   ├── UsageBar.tsx       # token usage progress bar
│   │   └── TierBadge.tsx      # free / pro / pro+api badge
│   ├── pages/
│   │   ├── Dashboard.tsx      # main page — job list + usage
│   │   ├── Settings.tsx       # API key, provider, tier management
│   │   └── Upgrade.tsx        # pricing/upgrade page
│   ├── App.tsx
│   └── main.tsx
```

### API client:
```ts
// dashboard/src/api/client.ts
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("orvitlab_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

### Main dashboard page:
```tsx
// dashboard/src/pages/Dashboard.tsx
import { useEffect, useState } from "react"
import api from "../api/client"
import { Job, User } from "../../../shared/types"

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [command, setCommand] = useState("")
  const [repo, setRepo] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get("/users/me").then((r) => setUser(r.data))
    api.get("/jobs").then((r) => setJobs(r.data))
  }, [])

  async function submitJob() {
    if (!command || !repo) return
    setLoading(true)
    try {
      const { data } = await api.post("/jobs", { command, repo })
      setJobs((prev) => [data, ...prev])
      setCommand("")
    } catch (err: any) {
      alert(err.response?.data?.error || "Job failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">OrvitLab</h1>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-brand-muted text-sm">@{user.githubUsername}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold uppercase
                ${user.tier === "pro_api" ? "bg-brand-accent text-white" :
                  user.tier === "pro" ? "bg-indigo-900 text-indigo-200" :
                  "bg-zinc-800 text-zinc-400"}`}>
                {user.tier === "pro_api" ? "Pro+API" : user.tier}
              </span>
            </div>
          )}
        </div>

        {/* Token usage bar (Pro+API only) */}
        {user?.tier === "pro_api" && user.tokenLimit && (
          <div className="bg-brand-surface rounded-xl p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-brand-muted">Tokens this month</span>
              <span className="text-brand-text">
                {user.tokensThisMonth.toLocaleString()} / {user.tokenLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-brand-accent h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (user.tokensThisMonth / user.tokenLimit) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Command input */}
        <div className="bg-brand-surface rounded-xl p-4 mb-8">
          <textarea
            className="w-full bg-transparent text-brand-text placeholder-brand-muted text-sm resize-none outline-none mb-3"
            placeholder="What do you want to build?"
            rows={3}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <div className="flex gap-2">
            <input
              className="flex-1 bg-zinc-800 text-brand-text placeholder-brand-muted text-sm px-3 py-2 rounded-lg outline-none"
              placeholder="owner/repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
            <button
              className="bg-brand-accent text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
              onClick={submitJob}
              disabled={loading || !command || !repo}
            >
              {loading ? "Running..." : "Run Agent"}
            </button>
          </div>
        </div>

        {/* Job list */}
        <h2 className="text-brand-muted text-xs uppercase tracking-wider mb-3">Recent Jobs</h2>
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="bg-brand-surface rounded-xl p-4">
              <div className="flex justify-between items-start mb-2">
                <p className="text-brand-text text-sm">{job.command}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ml-3 shrink-0
                  ${job.status === "done" ? "bg-green-900 text-green-300" :
                    job.status === "failed" ? "bg-red-900 text-red-300" :
                    job.status === "running" ? "bg-yellow-900 text-yellow-300" :
                    "bg-zinc-700 text-zinc-400"}`}>
                  {job.status}
                </span>
              </div>
              {job.prUrl && (
                <a
                  href={job.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-accent text-xs hover:underline"
                >
                  View PR →
                </a>
              )}
              {job.error && (
                <p className="text-red-400 text-xs mt-1">{job.error}</p>
              )}
              {job.tokensUsed && (
                <p className="text-brand-muted text-xs mt-1">{job.tokensUsed.toLocaleString()} tokens</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Upgrade page:
```tsx
// dashboard/src/pages/Upgrade.tsx
import api from "../api/client"

const tiers = [
  {
    name: "Free",
    price: "$0",
    tier: null,
    description: "Run OrvitLab on your own machine",
    features: [
      "5 jobs to try it out",
      "Local runner (your machine)",
      "Bring your own API key",
      "GitHub integration",
    ],
    cta: "Current plan",
    disabled: true,
  },
  {
    name: "Pro",
    price: "$10/mo",
    tier: "pro",
    description: "We run it for you, 24/7",
    features: [
      "Unlimited jobs",
      "Cloud runner (always on)",
      "Bring your own API key",
      "90 day job history",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    disabled: false,
    highlight: true,
  },
  {
    name: "Pro + API",
    price: "$25/mo",
    tier: "pro_api",
    description: "We run it and handle AI costs too",
    features: [
      "Everything in Pro",
      "1M tokens/month included",
      "No API key needed",
      "Usage dashboard",
      "Priority support",
    ],
    cta: "Upgrade to Pro+API",
    disabled: false,
  },
]

export default function Upgrade() {
  async function checkout(tier: string) {
    const { data } = await api.post("/billing/checkout", { tier })
    window.location.href = data.url
  }

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Simple pricing</h1>
        <p className="text-brand-muted text-center mb-12">
          Start free. Upgrade when you need it.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-2xl p-6 flex flex-col
                ${t.highlight
                  ? "bg-brand-accent ring-2 ring-brand-accent"
                  : "bg-brand-surface"}`}
            >
              <h2 className="text-xl font-bold mb-1">{t.name}</h2>
              <p className="text-3xl font-bold mb-1">{t.price}</p>
              <p className="text-sm opacity-70 mb-6">{t.description}</p>

              <ul className="space-y-2 mb-8 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="text-sm flex gap-2">
                    <span>✓</span> {f}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-3 rounded-xl font-semibold text-sm
                  ${t.disabled
                    ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    : t.highlight
                      ? "bg-white text-brand-accent hover:bg-zinc-100"
                      : "bg-brand-accent text-white hover:bg-indigo-500"}`}
                onClick={() => t.tier && checkout(t.tier)}
                disabled={t.disabled}
              >
                {t.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## Step 12 — Update Server for CORS + New Routes

Update `server/index.ts`:

```ts
// server/index.ts
import express from "express"
import cors from "cors"
import jobsRouter from "./routes/jobs"
import billingRouter from "./routes/billing"
import runnerRouter from "./routes/runner"
import usersRouter from "./routes/users"
import authRouter from "./auth/github"
import { jobWorker } from "./jobs/bullQueue"
import config from "./config/index"

const app = express()

app.use(cors({
  origin: [config.dashboardUrl, "orvitlab://"],
  credentials: true,
}))

app.use("/billing/webhook", express.raw({ type: "application/json" }))
app.use(express.json())

app.use("/auth", authRouter)
app.use("/jobs", jobsRouter)
app.use("/billing", billingRouter)
app.use("/runner", runnerRouter)
app.use("/users", usersRouter)

app.get("/health", (_, res) => res.json({ status: "ok", app: "OrvitLab" }))

// Log worker status
jobWorker.on("completed", (job) => console.log(`✅ Job ${job.id} completed`))
jobWorker.on("failed", (job, err) => console.error(`❌ Job ${job?.id} failed:`, err))

app.listen(config.port, () => {
  console.log(`OrvitLab server running on port ${config.port}`)
})
```

---

## Step 13 — Update Mobile Settings Screen

Add push notification registration and tier-aware upgrade options to `mobile/app/settings.tsx`:

```tsx
// Add to existing settings screen

import * as Notifications from "expo-notifications"
import axios from "axios"

// Register push token on mount
useEffect(() => {
  async function registerPushToken() {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== "granted") return
    const tokenData = await Notifications.getExpoPushTokenAsync()
    await axios.post(`${SERVER_URL}/runner/push-token`,
      { token: tokenData.data },
      { headers: { Authorization: `Bearer ${token}` } }
    )
  }
  registerPushToken()
}, [])

// Replace single upgrade button with two options for free users:
{user.tier === "free" && (
  <View className="gap-3 mt-2">
    <TouchableOpacity
      className="bg-brand-accent p-4 rounded-xl items-center"
      onPress={() => upgrade("pro")}
    >
      <Text className="text-white font-bold">Pro — $10/mo</Text>
      <Text className="text-indigo-200 text-xs mt-1">Cloud runner, always on</Text>
    </TouchableOpacity>

    <TouchableOpacity
      className="bg-zinc-800 border border-brand-accent p-4 rounded-xl items-center"
      onPress={() => upgrade("pro_api")}
    >
      <Text className="text-brand-accent font-bold">Pro+API — $25/mo</Text>
      <Text className="text-brand-muted text-xs mt-1">Cloud runner + 1M tokens/month included</Text>
    </TouchableOpacity>
  </View>
)}
```

---

## Step 14 — Deploy to Railway

1. Go to **railway.app** and create a new project
2. Connect your GitHub repo
3. Add a **Redis** plugin from the Railway dashboard
4. Set all environment variables from your `.env` in Railway's Variables tab
5. Update `GITHUB_CLIENT_ID` OAuth callback URL in GitHub to your Railway domain
6. Update `DASHBOARD_URL` to your deployed dashboard URL
7. Deploy — Railway auto-deploys on every push to main

---

## Final Folder Structure

```
orvitlab/
├── shared/
│   └── types.ts                         ✅ updated
├── server/
│   ├── auth/
│   │   ├── github.ts                    ✅ unchanged
│   │   └── middleware.ts                ✅ unchanged
│   ├── config/index.ts                  ✅ updated
│   ├── db/index.ts                      ✅ unchanged
│   ├── stripe/index.ts                  ✅ updated (3 tiers)
│   ├── notifications/index.ts           ✅ new
│   ├── providers/
│   │   ├── index.ts                     ✅ updated (token count)
│   │   └── anthropic.ts                ✅ updated (token count)
│   ├── github/client.ts                 ✅ unchanged
│   ├── jobs/
│   │   ├── queue.ts                     ✅ updated (limits + routing)
│   │   └── bullQueue.ts                 ✅ new
│   ├── routes/
│   │   ├── jobs.ts                      ✅ updated (job history)
│   │   ├── billing.ts                   ✅ updated (tier param)
│   │   ├── runner.ts                    ✅ updated (push token)
│   │   └── users.ts                     ✅ new
│   ├── index.ts                         ✅ updated
│   └── package.json
├── runner/
│   ├── index.ts                         ✅ unchanged
│   └── package.json
├── dashboard/                           ✅ new
│   ├── src/
│   │   ├── api/client.ts
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── Upgrade.tsx
│   │   └── App.tsx
│   └── package.json
├── mobile/
│   ├── app/
│   │   ├── index.tsx                    ✅ unchanged
│   │   ├── auth.tsx                     ✅ unchanged
│   │   └── settings.tsx                 ✅ updated (push + 2 upgrade options)
│   └── package.json
├── agent/
│   └── agent.js                         ✅ untouched
├── .env                                 updated
├── .env.example                         updated
└── .gitignore
```

---

## You Are Done When
- [ ] Free user hits 5 job limit → gets a clear upgrade message
- [ ] Pro user submits job → BullMQ processes it → push notification arrives
- [ ] Pro+API user submits job → pooled API key used → token usage tracked in database
- [ ] Pro+API user hits monthly token limit → gets a clear error message
- [ ] Stripe handles pro → pro_api upgrade and subscription cancellation correctly
- [ ] Web dashboard shows job list, token usage bar, and working upgrade page
- [ ] Railway deployment is live with all env vars set
- [ ] Push notifications arrive on device when jobs complete or fail

---

## What Comes Next (Phase 4 — Do Not Build Yet)
- Multiple AI provider support (OpenAI, Gemini, Ollama local models)
- Package local runner as Electron desktop app
- Team/org accounts with shared job history
- Webhook support (trigger jobs from GitHub events)
- CLI tool (`npx orvitlab "command" --repo owner/repo`)
- Usage analytics dashboard for you (not users) to monitor costs

---

*OrvitLab — command from anywhere, build everywhere.*