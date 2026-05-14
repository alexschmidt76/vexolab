import { useState, useEffect } from "react"
import { api } from "../api"
import { PROVIDER_MODELS, Provider } from "@shared/types"
import { useAuth } from "../lib/AuthContext"

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "GPT-4o (OpenAI)" },
  { id: "gemini", label: "Gemini (Google)" },
  { id: "ollama", label: "Ollama (Local — free tier only)" },
]

export default function Settings() {
  const { token, user, logout, refreshUser } = useAuth()

  const [provider, setProvider] = useState<Provider>(user?.provider ?? "anthropic")
  const [model, setModel] = useState(user?.model ?? "claude-sonnet-4-6")
  const [anthropicKey, setAnthropicKey] = useState("")
  const [openaiKey, setOpenaiKey] = useState("")
  const [geminiKey, setGeminiKey] = useState("")
  const [spendLimit, setSpendLimit] = useState(user?.spendLimitUsd?.toString() ?? "")
  const [slackWebhook, setSlackWebhook] = useState("")
  const [discordWebhook, setDiscordWebhook] = useState("")
  const [saved, setSaved] = useState(false)
  const [runnerToken, setRunnerToken] = useState("")

  useEffect(() => {
    if (user) {
      setProvider(user.provider ?? "anthropic")
      setModel(user.model ?? "claude-sonnet-4-6")
      setSpendLimit(user.spendLimitUsd?.toString() ?? "")
    }
  }, [user])

  const models = PROVIDER_MODELS[provider] || []

  function handleProviderChange(p: Provider) {
    setProvider(p)
    const defaultModel = PROVIDER_MODELS[p].find((m) => m.fast)?.id ?? PROVIDER_MODELS[p][0].id
    setModel(defaultModel)
  }

  async function save() {
    if (!token) return
    const body: Record<string, any> = { provider, model }
    if (anthropicKey.trim()) body.apiKey = anthropicKey.trim()
    if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim()
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim()
    if (spendLimit.trim()) {
      const parsed = parseFloat(spendLimit)
      if (!isNaN(parsed)) body.spendLimitUsd = parsed
    }
    await api(token).patch("/users/me", body)
    setAnthropicKey("")
    setOpenaiKey("")
    setGeminiKey("")
    await refreshUser()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveNotifications() {
    if (!token) return
    await api(token).patch("/users/me/notifications", {
      slackWebhookUrl: slackWebhook.trim() || null,
      discordWebhookUrl: discordWebhook.trim() || null,
    })
    setSlackWebhook("")
    setDiscordWebhook("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function generateRunnerToken() {
    if (!token) return
    const { data } = await api(token).post("/runner/token")
    setRunnerToken(data.token)
  }

  const select = "w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
  const input = "w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm outline-none focus:border-brand-accent"
  const label = "block text-xs text-brand-muted uppercase tracking-wider mb-2"

  if (!user) return null

  return (
    <div className="max-w-lg space-y-8">
      <h2 className="text-xl font-bold text-brand-text">Settings</h2>

      {/* Provider + model */}
      <section>
        <p className={label}>AI Provider</p>
        <select className={select} value={provider} onChange={(e) => handleProviderChange(e.target.value as Provider)}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </section>

      <section>
        <p className={label}>Model</p>
        <select className={select} value={model} onChange={(e) => setModel(e.target.value)}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </section>

      {/* API Keys */}
      <section>
        <p className={label}>API Keys</p>
        <p className="text-xs text-brand-muted mb-3">Keys are stored encrypted. Leave blank to keep the existing key.</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-brand-muted mb-1">
              Anthropic {user.hasAnthropicKey ? `✓ saved (${user.apiKey})` : "not set"}
            </p>
            <input type="password" className={input} placeholder="sk-ant-..." value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-brand-muted mb-1">
              OpenAI {user.hasOpenAiKey ? `✓ saved (${user.openaiApiKey})` : "not set"}
            </p>
            <input type="password" className={input} placeholder="sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-brand-muted mb-1">
              Gemini {user.hasGeminiKey ? `✓ saved (${user.geminiApiKey})` : "not set"}
            </p>
            <input type="password" className={input} placeholder="AIza..." value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
          </div>
        </div>
      </section>

      {provider === "ollama" && (
        <section className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="text-brand-text font-semibold text-sm mb-1">Ollama — Local Only</p>
          <p className="text-brand-muted text-xs">No API key needed. Make sure Ollama is running at <code className="text-brand-text">localhost:11434</code> and the selected model is pulled.</p>
        </section>
      )}

      {/* Spend limit */}
      <section>
        <p className={label}>Monthly Spend Limit (USD)</p>
        <input
          type="number"
          className={input}
          placeholder="e.g. 20 (no limit if blank)"
          value={spendLimit}
          onChange={(e) => setSpendLimit(e.target.value)}
          min="0"
          step="1"
        />
        <p className="text-xs text-brand-muted mt-1">Stops new jobs once your API spend hits this amount.</p>
      </section>

      <button
        className="bg-brand-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors"
        onClick={save}
      >
        {saved ? "Saved ✓" : "Save Settings"}
      </button>

      {/* Notifications */}
      <section>
        <p className={label}>Notifications</p>
        <p className="text-xs text-brand-muted mb-3">Leave blank to keep existing webhook. Set to empty to remove.</p>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-brand-muted mb-1">Slack Incoming Webhook URL</p>
            <input
              type="url"
              className={input}
              placeholder="https://hooks.slack.com/services/..."
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs text-brand-muted mb-1">Discord Webhook URL</p>
            <input
              type="url"
              className={input}
              placeholder="https://discord.com/api/webhooks/..."
              value={discordWebhook}
              onChange={(e) => setDiscordWebhook(e.target.value)}
            />
          </div>
        </div>
        <button
          className="mt-3 bg-brand-surface border border-brand-border text-brand-text text-sm font-semibold px-4 py-2 rounded-lg hover:border-brand-accent transition-colors"
          onClick={saveNotifications}
        >
          Save Notifications
        </button>
      </section>

      {/* Runner token */}
      <section>
        <p className={label}>Local Runner Token</p>
        <p className="text-xs text-brand-muted mb-3">Add to <code className="text-brand-text">runner/.env</code> as <code className="text-brand-text">VEXOLAB_TOKEN</code>.</p>
        {runnerToken ? (
          <div className="bg-brand-bg border border-brand-border rounded-lg px-4 py-3 text-xs font-mono text-brand-text break-all">{runnerToken}</div>
        ) : (
          <button
            className="bg-brand-surface border border-brand-border text-brand-text text-sm font-semibold px-4 py-2 rounded-lg hover:border-brand-accent transition-colors"
            onClick={generateRunnerToken}
          >
            Generate Runner Token
          </button>
        )}
      </section>

      {/* Account info */}
      <section>
        <p className={label}>Account</p>
        <div className="bg-brand-surface border border-brand-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-brand-text">@{user.githubUsername}</span>
            {user.tokensThisMonth != null && (
              <p className="text-xs text-brand-muted mt-1">{user.tokensThisMonth.toLocaleString()} tokens used this month</p>
            )}
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
            user.tier === "free" ? "bg-zinc-700 text-zinc-300" : "bg-brand-accent text-white"
          }`}>{user.tier}</span>
        </div>
      </section>

      {/* Logout */}
      <section>
        <button
          className="text-brand-muted text-sm hover:text-brand-text border border-brand-border px-4 py-2 rounded-lg transition-colors"
          onClick={logout}
        >
          Sign Out
        </button>
      </section>
    </div>
  )
}
