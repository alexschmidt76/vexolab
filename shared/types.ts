export type JobStatus = "pending" | "running" | "done" | "failed"
export type RunnerType = "local" | "cloud"
export type RunnerMode = "auto" | "standard" | "claude-cli"
export type UserTier = "free" | "starter" | "pro" | "pro_api"
export type JobTrigger = "manual" | "webhook" | "cli" | "scheduled"
export type Provider = "anthropic" | "openai" | "gemini" | "ollama"
export type NotificationChannel = "push" | "slack" | "discord"

export const PROVIDER_MODELS: Record<Provider, { id: string; label: string; fast?: boolean }[]> = {
  anthropic: [
    { id: "claude-opus-4-7", label: "Claude Opus 4.7 — most capable" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — recommended", fast: true },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fastest / cheapest" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o — most capable" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini — faster / cheaper", fast: true },
    { id: "o3-mini", label: "o3-mini — reasoning tasks" },
  ],
  gemini: [
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro — most capable" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash — faster / cheaper", fast: true },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash — latest" },
  ],
  ollama: [
    { id: "codellama", label: "CodeLlama — best for code" },
    { id: "llama3", label: "Llama 3 — general purpose", fast: true },
    { id: "mistral", label: "Mistral — fast and capable" },
    { id: "deepseek-coder", label: "DeepSeek Coder — code specialist" },
  ],
}

export type JobThread = {
  id: string
  userId: string
  repo: string
  branch: string
  originalCommand: string
  status: "open" | "resolved" | "abandoned"
  iterationCount: number
  prUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export type JobIteration = {
  id: string
  threadId: string
  jobId: string | null
  iterationNumber: number
  command: string
  errorReport: string | null
  selfReview: string | null
  buildOutput: string | null
  status: JobStatus
  tokensUsed: number | null
  provider: Provider
  model: string
  createdAt: Date
}

export type Job = {
  id: string
  userId: string
  threadId: string | null
  command: string
  repo: string
  status: JobStatus
  runnerType: RunnerType
  trigger: JobTrigger
  branch: string | null
  prUrl: string | null
  error: string | null
  tokensUsed: number | null
  provider: Provider
  model: string
  selfReview: string | null
  buildOutput: string | null
  createdAt: Date
  updatedAt: Date
}

export type User = {
  id: string
  githubId: string
  githubUsername: string
  githubToken: string
  tier: UserTier
  freePromptsRemaining: number
  provider: Provider
  model: string
  apiKey: string | null
  openaiApiKey: string | null
  geminiApiKey: string | null
  stripeCustomerId: string | null
  expoPushToken: string | null
  slackWebhookUrl: string | null
  discordWebhookUrl: string | null
  spendLimitUsd: number | null
  hasAnthropicKey: boolean
  hasOpenAiKey: boolean
  hasGeminiKey: boolean
  jobsThisMonth: number
  tokensThisMonth: number
  createdAt: Date
}

export type SpendLimitStatus = {
  limitUsd: number | null
  spentUsd: number
  remainingUsd: number | null
  isNearLimit: boolean
  isAtLimit: boolean
}

export type ScheduledJob = {
  id: string
  userId: string
  command: string
  repo: string
  cronExpression: string
  humanReadable: string
  provider: Provider
  model: string
  enabled: boolean
  lastRunAt: Date | null
  nextRunAt: Date
  createdAt: Date
}

export type PublicApiKey = {
  id: string
  userId: string
  name: string
  keyHash: string
  lastUsedAt: Date | null
  createdAt: Date
}

export type TokenUsage = {
  id: string
  userId: string
  jobId: string
  tokensUsed: number
  createdAt: Date
}

export type UserSettings = {
  provider: Provider
  model: string
  apiKey: string
  githubToken: string
  githubUsername: string
}

export type WebhookConfig = {
  id: string
  userId: string
  repo: string
  secret: string
  events: string[]
  createdAt: Date
}

export type AdminStats = {
  totalUsers: number
  freeUsers: number
  starterUsers: number
  proUsers: number
  proApiUsers: number
  jobsToday: number
  tokensThisMonth: number
  estimatedCostThisMonth: string
  mrr: number
  estimatedMargin: string
}
