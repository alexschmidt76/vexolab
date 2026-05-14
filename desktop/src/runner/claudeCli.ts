import { spawn, exec } from "child_process"
import { promisify } from "util"
import path from "path"
import fs from "fs/promises"
import os from "os"
const execAsync = promisify(exec)

// check if the claude binary is on PATH
export async function detectClaudeCli(): Promise<boolean> {
  try {
    await execAsync("claude --version")
    return true
  } catch {
    return false
  }
}

export async function runClaudeCli(
  job: any
): Promise<{ branch: string; prUrl: string }> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error("GITHUB_TOKEN not set")

  const [owner, repoName] = job.repo.split("/")
  const tempDir = path.join(os.tmpdir(), `vexolab-${job.id}`)
  await fs.mkdir(tempDir, { recursive: true })

  try {
    // clone the repo into a temp dir
    await execAsync(
      `git clone https://x-access-token:${token}@github.com/${job.repo}.git "${tempDir}"`
    )

    const branchName = `vexolab/${job.id.slice(0, 8)}`
    await execAsync(`git checkout -b ${branchName}`, { cwd: tempDir })

    // run claude code non-interactively
    await runClaudeCodeProcess(job.command, tempDir)

    // commit all changes claude made
    await execAsync("git add -A", { cwd: tempDir })

    const { stdout: diffStat } = await execAsync("git diff --cached --stat", { cwd: tempDir })
    if (!diffStat.trim()) throw new Error("Claude CLI made no changes")

    await execAsync(
      `git commit -m "VexoLab: ${job.command.slice(0, 72)}"`,
      { cwd: tempDir }
    )
    await execAsync(`git push origin ${branchName}`, { cwd: tempDir })

    const { Octokit } = await import("@octokit/rest")
  const octokit = new Octokit({ auth: token, headers: { "X-GitHub-Api-Version": "2022-11-28" } })
    const { data: pr } = await octokit.pulls.create({
      owner,
      repo: repoName,
      title: job.command.slice(0, 72),
      body: `Created by VexoLab (Claude CLI runner)\n\nCommand: "${job.command}"`,
      head: branchName,
      base: "main",
    })

    return { branch: branchName, prUrl: pr.html_url }
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

function runClaudeCodeProcess(command: string, cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "claude",
      ["--print", command, "--output-format", "text", "--no-interactive"],
      {
        cwd,
        env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
      }
    )

    let errorOutput = ""
    proc.stderr.on("data", (data: Buffer) => { errorOutput += data.toString() })

    proc.on("close", (code: number) => {
      if (code === 0) resolve()
      else reject(new Error(errorOutput || `Claude CLI exited with code ${code}`))
    })

    // 5 minute timeout
    setTimeout(() => {
      proc.kill()
      reject(new Error("Claude CLI timed out after 5 minutes"))
    }, 5 * 60 * 1000)
  })
}
