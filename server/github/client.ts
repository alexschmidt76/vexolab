import { Octokit } from "@octokit/rest"

// create an octokit instance using the user's github token
function client(token: string) {
  return new Octokit({ auth: token })
}

// get the sha of main and create a new branch from it
export async function createBranch(
  repo: string,
  branchName: string,
  token: string
): Promise<void> {
  const octokit = client(token)
  const [owner, repoName] = repo.includes("/") ? repo.split("/") : [null, repo]

  const { data: ref } = await octokit.git.getRef({
    owner: owner!,
    repo: repoName,
    ref: "heads/main",
  })
  await octokit.git.createRef({
    owner: owner!,
    repo: repoName,
    ref: `refs/heads/${branchName}`,
    sha: ref.object.sha,
  })
}

// create or update a file on the given branch
export async function commitFile(
  repo: string,
  branch: string,
  filePath: string,
  content: string,
  message: string,
  token: string
): Promise<void> {
  const octokit = client(token)
  const [owner, repoName] = repo.split("/")
  let sha: string | undefined

  // get the existing file sha if it already exists
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: filePath,
      ref: branch,
    })
    if (!Array.isArray(data)) sha = data.sha
  } catch {
    // new file — no sha needed
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo: repoName,
    path: filePath,
    branch,
    message,
    content: Buffer.from(content).toString("base64"),
    ...(sha ? { sha } : {}),
  })
}

// open a pull request from the given branch into main
export async function openPR(
  repo: string,
  branch: string,
  title: string,
  body: string,
  token: string
): Promise<string> {
  const octokit = client(token)
  const [owner, repoName] = repo.split("/")
  const { data } = await octokit.pulls.create({
    owner,
    repo: repoName,
    title,
    body,
    head: branch,
    base: "main",
  })
  return data.html_url
}
