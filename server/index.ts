import express from "express"
import cors from "cors"
import jobsRouter from "./routes/jobs"
import config from "./config/index"

const app = express()
app.use(cors())
app.use(express.json())
app.use("/jobs", jobsRouter)

app.get("/health", (_, res) => res.json({ status: "ok", app: "OrvitLab" }))

app.listen(config.port, () => {
  console.log(`OrvitLab server running on port ${config.port}`)
})
