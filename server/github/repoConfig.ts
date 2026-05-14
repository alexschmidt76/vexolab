import { Octokit } from "@octokit/rest"

export async function getRepoConfig(repo: string, githubToken: string): Promise<string | null> {
  const octokit = new Octokit({ auth: githubToken })
  const [owner, repoName] = repo.split("/")

  try {
    const { data } = await octokit.repos.getContent({ owner, repo: repoName, path: ".orvitlab.md" })
    if (Array.isArray(data) || data.type !== "file") return null
    return Buffer.from(data.content, "base64").toString("utf-8")
  } catch {
    return null
  }
}
