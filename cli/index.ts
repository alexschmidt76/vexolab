#!/usr/bin/env node
import { Command } from "commander"
import axios from "axios"
import chalk from "chalk"
import ora from "ora"
import dotenv from "dotenv"

dotenv.config()

const API_URL = process.env.VEXOLAB_SERVER_URL || "https://api.vexolab.com"
const TOKEN = process.env.VEXOLAB_TOKEN

function authHeaders() {
  return { Authorization: `Bearer ${TOKEN}` }
}

function requireToken() {
  if (!TOKEN) {
    console.error(chalk.red("Error: VEXOLAB_TOKEN env var not set"))
    console.log(chalk.dim("Log in at your server /auth/github, then set VEXOLAB_TOKEN=<jwt>"))
    process.exit(1)
  }
}

const program = new Command()

program
  .name("vexolab")
  .description("VexoLab CLI — run AI dev agent jobs from your terminal")
  .version(process.env.CLI_VERSION || "1.0.0")

program
  .command("run <command>")
  .description("Run an agent job")
  .requiredOption("-r, --repo <repo>", "GitHub repo (owner/repo)")
  .option("-p, --provider <provider>", "AI provider (anthropic, openai, gemini, ollama)", "anthropic")
  .option("-m, --model <model>", "Model to use (e.g. claude-sonnet-4-6, gpt-4o)")
  .option("--wait", "Wait for job to complete and show result", false)
  .action(async (command, options) => {
    requireToken()
    const spinner = ora("Submitting job...").start()

    try {
      const { data: job } = await axios.post(
        `${API_URL}/jobs`,
        { command, repo: options.repo, provider: options.provider, model: options.model },
        { headers: authHeaders() }
      )

      spinner.succeed(`Job created: ${chalk.cyan(job.id)}`)
      console.log(chalk.dim(`Command: "${command}"`))
      console.log(chalk.dim(`Repo:    ${options.repo}`))
      console.log(chalk.dim(`Runner:  ${job.runner_type} | Provider: ${job.provider}`))

      if (options.wait) {
        const waitSpinner = ora("Waiting for job to complete...").start()
        let result = job

        while (result.status === "pending" || result.status === "running") {
          await new Promise((r) => setTimeout(r, 3000))
          const { data } = await axios.get(`${API_URL}/jobs/${job.id}`, {
            headers: authHeaders(),
          })
          result = data
        }

        if (result.status === "done") {
          waitSpinner.succeed(chalk.green("Job complete!"))
          if (result.pr_url) console.log(chalk.cyan(`PR: ${result.pr_url}`))
        } else {
          waitSpinner.fail(chalk.red(`Job failed: ${result.error}`))
          process.exit(1)
        }
      } else {
        console.log(chalk.dim(`\nCheck status: vexolab status ${job.id}`))
      }
    } catch (err: any) {
      spinner.fail(chalk.red(err.response?.data?.error || err.message))
      process.exit(1)
    }
  })

program
  .command("status <jobId>")
  .description("Check the status of a job")
  .action(async (jobId) => {
    requireToken()

    try {
      const { data: job } = await axios.get(`${API_URL}/jobs/${jobId}`, {
        headers: authHeaders(),
      })

      const statusColor =
        job.status === "done" ? chalk.green :
        job.status === "failed" ? chalk.red :
        job.status === "running" ? chalk.yellow :
        chalk.dim

      console.log(`Status:   ${statusColor(job.status)}`)
      console.log(`Command:  ${chalk.white(job.command)}`)
      console.log(`Provider: ${chalk.dim(job.provider)} / ${chalk.dim(job.model)}`)
      if (job.branch) console.log(`Branch:   ${chalk.cyan(job.branch)}`)
      if (job.pr_url) console.log(`PR:       ${chalk.cyan(job.pr_url)}`)
      if (job.error) console.log(`Error:    ${chalk.red(job.error)}`)
      if (job.tokens_used) console.log(`Tokens:   ${chalk.dim(job.tokens_used.toLocaleString())}`)
    } catch (err: any) {
      console.error(chalk.red(err.response?.data?.error || err.message))
      process.exit(1)
    }
  })

program
  .command("jobs")
  .description("List recent jobs")
  .action(async () => {
    requireToken()

    try {
      const { data: jobs } = await axios.get(`${API_URL}/jobs`, {
        headers: authHeaders(),
      })

      if (jobs.length === 0) {
        console.log(chalk.dim("No jobs yet."))
        return
      }

      jobs.slice(0, 10).forEach((job: any) => {
        const statusColor =
          job.status === "done" ? chalk.green :
          job.status === "failed" ? chalk.red :
          job.status === "running" ? chalk.yellow :
          chalk.dim

        console.log(
          `${chalk.dim(job.id.slice(0, 8))}  ${statusColor(job.status.padEnd(8))}  ${chalk.white(job.command.slice(0, 50))}`
        )
      })
    } catch (err: any) {
      console.error(chalk.red(err.response?.data?.error || err.message))
      process.exit(1)
    }
  })

program
  .command("whoami")
  .description("Show current user info")
  .action(async () => {
    requireToken()

    try {
      const { data: user } = await axios.get(`${API_URL}/users/me`, {
        headers: authHeaders(),
      })

      // never print full api keys — first 8 chars only
      const keyPreview = user.api_key
        ? `${user.api_key.slice(0, 8)}...`
        : chalk.dim("not set")

      console.log(`User:     ${chalk.cyan(user.github_username)}`)
      console.log(`Tier:     ${chalk.white(user.tier)}`)
      console.log(`Provider: ${chalk.white(user.provider)} / ${chalk.white(user.model)}`)
      console.log(`API Key:  ${keyPreview}`)
      if (user.tokensThisMonth != null) {
        console.log(`Tokens:   ${chalk.white(user.tokensThisMonth.toLocaleString())} this month`)
      }
    } catch (err: any) {
      console.error(chalk.red(err.response?.data?.error || err.message))
      process.exit(1)
    }
  })

program.parse()
