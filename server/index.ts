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

const app = express()

// allow cross-origin requests from any localhost port (dashboard, mobile dev server)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin.startsWith("http://localhost")) return cb(null, true)
    cb(null, false)
  },
  credentials: true,
}))

// raw body for stripe and github webhook signature verification — must come before express.json()
app.use("/billing/webhook", express.raw({ type: "application/json" }))
app.use("/webhooks/receive", express.raw({ type: "application/json" }))
app.use(express.json())

app.use("/auth", authRouter)
app.use("/jobs", jobsRouter)
app.use("/billing", billingRouter)
app.use("/runner", runnerRouter)
app.use("/users", usersRouter)
app.use("/webhooks", webhooksRouter)
app.use("/admin", adminRouter)

app.get("/health", (_, res) => res.json({ status: "ok", app: "OrvitLab", version: config.cliVersion }))
app.get("/billing/success", (_, res) => res.send("<h2>Upgrade successful! You are now on a paid plan.</h2>"))
app.get("/billing/cancel", (_, res) => res.send("<h2>Upgrade cancelled.</h2>"))

// start the BullMQ worker for processing cloud jobs
const worker = startWorker()
worker.on("completed", (job) => console.log(`Cloud job ${job.id} completed`))
worker.on("failed", (job, err) => console.error(`Cloud job ${job?.id} failed:`, err.message))

app.listen(config.port, () => {
  console.log(`OrvitLab server running on port ${config.port}`)
})
