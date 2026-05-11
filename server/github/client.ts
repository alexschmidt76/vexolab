import { Octokit } from "@octokit/rest"
import config from "../config/index"

const octokit = new Octokit({ auth: config.githubToken })
const owner = config.githubUsername

export async function createBranch(
  repo: string,
  branchName: string
): Promise<void> {
  const { data: ref } = await octokit.git.getRef({
    owner,
    repo,
    ref: "heads/main",
  })
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  })
}

export async function commitFile(
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string
): Promise<void> {
  let sha: string | undefined

  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref: branch,
    })
    if (!Array.isArray(data)) sha = data.sha
  } catch {
    // File doesn't exist yet — create it fresh
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    branch,
    message,
    content: Buffer.from(content).toString("base64"),
    ...(sha ? { sha } : {}),
  })
}

export async function openPR(
  repo: string,
  branch: string,
  title: string,
  body: string
): Promise<string> {
  const { data } = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branch,
    base: "main",
  })
  return data.html_url
}
