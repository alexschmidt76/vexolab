export type JobStatus = "pending" | "running" | "done" | "failed"
export type Provider = "anthropic" | "openai" | "gemini"
export type RunnerType = "local" | "cloud"
export type UserTier = "free" | "pro"

export type Job = {
  id: string
  userId: string
  command: string
  repo: string
  status: JobStatus
  runnerType: RunnerType
  branch: string | null
  prUrl: string | null
  error: string | null
  createdAt: Date
  updatedAt: Date
}

export type User = {
  id: string
  githubId: string
  githubUsername: string
  githubToken: string
  tier: UserTier
  provider: Provider
  apiKey: string | null
  stripeCustomerId: string | null
  createdAt: Date
}

export type UserSettings = {
  provider: Provider
  apiKey: string
  githubToken: string
  githubUsername: string
}
