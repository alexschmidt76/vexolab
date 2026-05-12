import axios from "axios"
import dotenv from "dotenv"
import Anthropic from "@anthropic-ai/sdk"
import { Octokit } from "@octokit/rest"
dotenv.config()

const SERVER_URL = process.env.ORVITLAB_SERVER_URL || "https://api.orvitlab.com"
const AUTH_TOKEN = process.env.ORVITLAB_TOKEN!
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS || "5000")

const headers = { Authorization: `Bearer ${AUTH_TOKEN}` }

// look for new jobs
async function pollForJobs() {
  try {
    const { data } = await axios.get(`${SERVER_URL}/runner/next`, { headers })
    if (data.job) {
      console.log(`Picked up job: ${data.job.id}`)
      console.log(`Command: "${data.job.command}"`)
      console.log(`Repo: ${data.job.repo}`)
      await processJob(data.job)
    }
  } catch (err: any) {
    console.error("Poll error:", err.message)
  }
}

// try to complete a job
async function processJob(job: any) {
  try {
    // tell the server that the job is running
    await axios.post(
      `${SERVER_URL}/runner/complete`,
      { jobId: job.id, status: "running" },
      { headers }
    )

    // make api call to anthropic using the user's api key
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: 
        `You are an AI developer agent. Respond ONLY in this JSON format:
        {
          "branch": "feature/branch-name",
          "summary": "what this change does",
          "files": [{ "path": "...", "content": "..." }]
        }`,
      messages: [{ role: "user", content: job.command }],
    })

    // process the response
    const first = response.content[0]
    const raw = first?.type === "text" ? first.text : ""
    const result = JSON.parse(raw.replace(/```json|```/g, "").trim())

    // connect to github and parse repo string
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })
    const [owner, repo] = job.repo.split("/")

    // get main branch and create a new branch
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: "heads/main" })
    await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${result.branch}`,
      sha: ref.object.sha,
    })

    // update existing files and create new ones
    for (const file of result.files) {
      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: file.path,
        branch: result.branch,
        message: `OrvitLab: ${result.summary}`,
        content: Buffer.from(file.content).toString("base64"),
      })
    }

    // create pull request with main branch
    const { data: pr } = await octokit.pulls.create({
      owner, repo,
      title: result.summary,
      body: `Created by OrvitLab\n\nCommand: "${job.command}"`,
      head: result.branch,
      base: "main",
    })

    console.log(`Done - PR: ${pr.html_url}`)
    
    await axios.post(
      `${SERVER_URL}/runner/complete`,
      { jobId: job.id, status: "done", branch: result.branch, prUrl: pr.html_url },
      { headers }
    )
  } catch (err: any) {
    console.error(`Job failed: ${err.message}`)
    await axios.post(
      `${SERVER_URL}/runner/complete`,
      { jobId: job.id, status: "failed", error: err.message },
      { headers }
    )
  }
}

console.log("OrvitLab local runner started - polling for jobs...")
setInterval(pollForJobs, POLL_INTERVAL)
