import { db } from "../db/index"
import { addJob } from "./queue"
import config from "../config/index"
import cronstrue from "cronstrue"
import { parseExpression } from "cron-parser"

export function getNextRunTime(cronExpression: string): Date {
  return parseExpression(cronExpression).next().toDate()
}

export function describeSchedule(cronExpression: string): string {
  try {
    return cronstrue.toString(cronExpression)
  } catch {
    return cronExpression
  }
}

export function startScheduler() {
  setInterval(async () => {
    const now = new Date().toISOString()

    const { data: dueJobs } = await db
      .from("scheduled_jobs")
      .select("*, users(*)")
      .eq("enabled", true)
      .lte("next_run_at", now)

    for (const scheduled of dueJobs || []) {
      const user = scheduled.users
      try {
        await addJob(
          user.id,
          scheduled.command,
          scheduled.repo,
          user.tier,
          "cloud",
          scheduled.provider,
          scheduled.model,
          user.api_key,
          user.github_token,
          "scheduled"
        )
        await db.from("scheduled_jobs").update({
          last_run_at: now,
          next_run_at: getNextRunTime(scheduled.cron_expression),
        }).eq("id", scheduled.id)
      } catch (err: any) {
        console.error(`Scheduled job ${scheduled.id} failed:`, err.message)
      }
    }
  }, config.schedulerPollInterval)
}
