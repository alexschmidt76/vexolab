export type JobStatus = "pending" | "running" | "done" | "failed"

export type Job = {
  id: string
  command: string
  status: JobStatus
  branch: string | null
  prUrl: string | null
  error: string | null
  createdAt: Date
  updatedAt: Date
}

export type Provider = "anthropic" | "openai" | "gemini"

export type UserSettings = {
  provider: Provider
  apiKey: string
  githubToken: string
  githubUsername: string
}
