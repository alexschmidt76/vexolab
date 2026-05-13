import { api } from "../api"
import { useAuth } from "../lib/AuthContext"

type Tier = "starter" | "pro" | "pro_api"

const PLANS: { tier: Tier; name: string; price: string; limit: string; description: string }[] = [
  {
    tier: "starter",
    name: "Starter",
    price: "$5/mo",
    limit: "100 jobs/month",
    description: "Cloud runner, OrvitLab's API key included. No setup required.",
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$10/mo",
    limit: "500 jobs/month",
    description: "Everything in Starter with a higher monthly limit.",
  },
  {
    tier: "pro_api",
    name: "Pro + API Key",
    price: "$25/mo",
    limit: "Unlimited",
    description: "Bring your own Anthropic key. No usage caps, full control.",
  },
]

export default function Upgrade() {
  const { token, user } = useAuth()
  async function checkout(tier: Tier) {
    const { data } = await api(token!).post("/billing/checkout", { tier })
    window.location.href = data.url
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-brand-text mb-2">Upgrade</h2>
      <p className="text-brand-muted text-sm mb-8">
        Free tier: 15 jobs/month on your local machine. Upgrade for cloud execution and higher limits.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isCurrent = user?.tier === plan.tier
          return (
            <div
              key={plan.tier}
              className={`bg-brand-surface border rounded-2xl p-6 flex flex-col ${
                isCurrent ? "border-brand-accent" : "border-brand-border"
              }`}
            >
              {isCurrent && (
                <span className="text-xs text-brand-accent font-semibold uppercase mb-2">
                  Current Plan
                </span>
              )}
              <h3 className="text-brand-text font-bold text-lg">{plan.name}</h3>
              <p className="text-brand-accent font-semibold text-2xl mt-1 mb-1">{plan.price}</p>
              <p className="text-brand-muted text-xs mb-1">{plan.limit}</p>
              <p className="text-brand-muted text-sm mt-3 flex-1">{plan.description}</p>
              <button
                className={`mt-6 w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  isCurrent
                    ? "bg-zinc-700 text-zinc-400 cursor-default"
                    : "bg-brand-accent text-white hover:bg-indigo-500"
                }`}
                onClick={() => !isCurrent && checkout(plan.tier)}
                disabled={isCurrent}
              >
                {isCurrent ? "Active" : `Upgrade to ${plan.name}`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
