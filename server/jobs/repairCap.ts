import { User } from "../../shared/types"

export type RepairCapResult = {
  allowed: boolean
  cap: number | null
  remaining: number | null
  isSoftWarning: boolean
  message: string | null
}

export function checkRepairCap(user: User, currentIterations: number): RepairCapResult {
  // Own API key = no cap; spend limit is the only governor
  if (user.apiKey) {
    const isSoftWarning = currentIterations >= 10 && user.tier === "starter"
    return {
      allowed: true,
      cap: null,
      remaining: null,
      isSoftWarning,
      message: isSoftWarning
        ? `This thread has made ${currentIterations} repair attempts. Your API costs may be significant — continue?`
        : null,
    }
  }

  // Free tier: check prompt counter
  if (user.tier === "free") {
    const remaining = user.freePromptsRemaining ?? 0
    return {
      allowed: remaining > 0,
      cap: null,
      remaining,
      isSoftWarning: false,
      message: remaining <= 0
        ? `Your free prompts are used up. Add your own API key or upgrade to continue.`
        : null,
    }
  }

  // Paid tiers using pool key — no hard cap
  return {
    allowed: true,
    cap: null,
    remaining: null,
    isSoftWarning: false,
    message: null,
  }
}
