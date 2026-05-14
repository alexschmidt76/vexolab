import Anthropic from "@anthropic-ai/sdk"

export async function runStandard(
  job: any
): Promise<{ branch: string; prUrl: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set")

  const client = new Anthropic({ apiKey })
  const response = await client.messages.create({
    model: job.model || "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are an AI developer agent. Respond ONLY in this JSON format:
{
  "branch": "feature/branch-name",
  "summary": "what this change does",
  "files": [{ "path": "...", "content": "..." }]
}`,
    messages: [{ role: "user", content: job.command }],
  })

  const raw = response.content[0].type === "text" ? response.content[0].text : ""
  const result = JSON.parse(raw.replace(/```json|```/g, "").trim())

  return pushToGitHub(job.repo, result, job.command)
}

async function pushToGitHub(
  repo: string,
  result: any,
  command: string
): Promise<{ branch: string; prUrl: string }> {
  const token = process.env.GITHUB_TOKEN
  if (!token) throw new Error("GITHUB_TOKEN not set")

  const { Octokit } = await import("@octokit/rest")
  const octokit = new Octokit({ auth: token, headers: { "X-GitHub-Api-Version": "2022-11-28" } })
  const [owner, repoName] = repo.split("/")

  const { data: ref } = await octokit.git.getRef({ owner, repo: repoName, ref: "heads/main" })
  await octokit.git.createRef({
    owner,
    repo: repoName,
    ref: `refs/heads/${result.branch}`,
    sha: ref.object.sha,
  })

  for (const file of result.files) {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: file.path,
      branch: result.branch,
      message: `VexoLab: ${result.summary}`,
      content: Buffer.from(file.content).toString("base64"),
    })
  }

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo: repoName,
    title: result.summary,
    body: `Created by VexoLab\n\nCommand: "${command}"`,
    head: result.branch,
    base: "main",
  })

  return { branch: result.branch, prUrl: pr.html_url }
}
