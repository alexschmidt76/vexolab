process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err.message, err.stack)
  process.exit(1)
})
process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason)
  process.exit(1)
})

import express from "express"
import cors from "cors"
import jobsRouter from "./routes/jobs"
import billingRouter from "./routes/billing"
import runnerRouter from "./routes/runner"
import usersRouter from "./routes/users"
import webhooksRouter from "./routes/webhooks"
import adminRouter from "./routes/admin"
import authRouter from "./auth/github"
import config from "./config/index"
import { startWorker } from "./jobs/bullQueue"

console.log("=== SERVER STARTING ===")
console.log("PORT:", process.env.PORT || "(not set, using 3000)")
const redisHost = (() => { try { return new URL(process.env.REDIS_URL || "").hostname } catch { return "parse-error" } })()
console.log("REDIS_URL host:", redisHost || "NOT SET")
console.log("SUPABASE_URL:", process.env.SUPABASE_URL ? "set" : "NOT SET")
console.log("JWT_SECRET:", process.env.JWT_SECRET ? "set" : "NOT SET")
console.log("GITHUB_CLIENT_ID:", process.env.GITHUB_CLIENT_ID ? "set" : "NOT SET")

const app = express()

const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^https?:\/\/orvitlab\.dev$/,
  /^https?:\/\/.*\.orvitlab\.dev$/,
]

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.some((re) => re.test(origin))) return cb(null, true)
    cb(null, false)
  },
  credentials: true,
}))

// raw body for stripe and github webhook signature verification - must come before express.json()
app.use("/billing/webhook", express.raw({ type: "application/json" }))
app.use("/webhooks/receive", express.raw({ type: "application/json" }))
app.use(express.json())

// server routes
app.use("/auth", authRouter)
app.use("/jobs", jobsRouter)
app.use("/billing", billingRouter)
app.use("/runner", runnerRouter)
app.use("/users", usersRouter)
app.use("/webhooks", webhooksRouter)
app.use("/admin", adminRouter)

app.get("/", (_, res) => res.json({ ok: true }))
app.get("/health", (_, res) => res.json({ status: "ok", app: "OrvitLab", version: config.cliVersion }))
app.get("/billing/success", (_, res) => res.send("<h2>Upgrade successful! You are now on a paid plan.</h2>"))
app.get("/billing/cancel", (_, res) => res.send("<h2>Upgrade cancelled.</h2>"))

// start the BullMQ worker for processing cloud jobs
try {
  const worker = startWorker()
  worker.on("completed", (job) => console.log(`Cloud job ${job.id} completed`))
  worker.on("failed", (job, err) => console.error(`Cloud job ${job?.id} failed:`, err.message))
  worker.on("error", (err) => console.error("BullMQ worker error:", err.message))
} catch (err: any) {
  console.error("BullMQ worker failed to start (Redis unavailable?):", err.message)
}

const server = app.listen(config.port, () => {
  console.log(`OrvitLab server running on port ${config.port}`)
})

process.on("SIGTERM", () => {
  console.log("SIGTERM received — Railway is stopping this container")
  server.close(() => process.exit(0))
})
