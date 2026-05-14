import { db } from "../db/index"
import { SpendLimitStatus } from "../../shared/types"

const COST_PER_TOKEN: Record<string, number> = {
  "claude-opus-4-7":         0.000015,
  "claude-sonnet-4-6":       0.000003,
  "claude-haiku-4-5-20251001": 0.00000025,
  "gpt-4o":                  0.000005,
  "gpt-4o-mini":             0.00000015,
  "o3-mini":                 0.000001,
  "gemini-1.5-pro":          0.0000035,
  "gemini-1.5-flash":        0.00000035,
  "gemini-2.0-flash":        0.00000035,
  "codellama":               0,
  "llama3":                  0,
  "mistral":                 0,
  "deepseek-coder":          0,
}

export function estimateCost(tokensUsed: number, model: string): number {
  const rate = COST_PER_TOKEN[model] ?? 0.000003
  return tokensUsed * rate
}

export async function getSpendStatus(userId: string, spendLimitUsd: number | null): Promise<SpendLimitStatus> {
  const month = new Date().toISOString().slice(0, 7)

  const { data: jobs } = await db
    .from("jobs")
    .select("tokens_used, model")
    .eq("user_id", userId)
    .gte("created_at", `${month}-01`)
    .not("tokens_used", "is", null)

  const spentUsd = (jobs || []).reduce((sum, j) => {
    return sum + estimateCost(j.tokens_used || 0, j.model)
  }, 0)

  const remainingUsd = spendLimitUsd !== null ? spendLimitUsd - spentUsd : null
  const isNearLimit = spendLimitUsd !== null && spentUsd >= spendLimitUsd * 0.8
  const isAtLimit = spendLimitUsd !== null && spentUsd >= spendLimitUsd

  return { limitUsd: spendLimitUsd, spentUsd, remainingUsd, isNearLimit, isAtLimit }
}

export async function checkSpendLimit(userId: string, spendLimitUsd: number | null): Promise<void> {
  if (!spendLimitUsd) return

  const status = await getSpendStatus(userId, spendLimitUsd)
  if (status.isAtLimit) {
    throw new Error(
      `Monthly spend limit of $${spendLimitUsd} reached ($${status.spentUsd.toFixed(2)} spent). ` +
      `Raise your limit in Settings to continue.`
    )
  }
}
