import express from "express"
import cors from "cors"
import jobsRouter from "./routes/jobs"
import billingRouter from "./routes/billing"
import runnerRouter from "./routes/runner"
import usersRouter from "./routes/users"
import authRouter from "./auth/github"
import config from "./config/index"

const app = express()
app.use(cors())

// Stripe webhook needs raw body — must come before express.json()
app.use("/billing/webhook", express.raw({ type: "application/json" }))
app.use(express.json())

app.use("/auth", authRouter)
app.use("/jobs", jobsRouter)
app.use("/billing", billingRouter)
app.use("/runner", runnerRouter)
app.use("/users", usersRouter)

app.get("/health", (_, res) => res.json({ status: "ok", app: "OrvitLab" }))
app.get("/billing/success", (_, res) => res.send("<h2>Upgrade successful! You are now on Pro.</h2>"))
app.get("/billing/cancel", (_, res) => res.send("<h2>Upgrade cancelled.</h2>"))

app.listen(config.port, () => {
  console.log(`OrvitLab server running on port ${config.port}`)
})
