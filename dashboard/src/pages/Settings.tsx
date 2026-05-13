import { useState } from "react"
import { api } from "../api"
import { PROVIDER_MODELS, Provider } from "@shared/types"

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "GPT-4o (OpenAI)" },
  { id: "gemini", label: "Gemini (Google)" },
  { id: "ollama", label: "Ollama (Local — free tier only)" },
]

export default function Settings({
  token,
  user,
  onUpdate,
}: {
  token: string
  user: any
  onUpdate: (u: any) => void
}) {
  const [provider, setProvider] = useState<Provider>(user.provider || "anthropic")
  const [model, setModel] = useState(user.model || "claude-sonnet-4-6")
  const [apiKey, setApiKey] = useState(user.api_key || "")
  const [openaiKey, setOpenaiKey] = useState(user.openai_api_key || "")
  const [geminiKey, setGeminiKey] = useState(user.gemini_api_key || "")
  const [saved, setSaved] = useState(false)
  const [runnerToken, setRunnerToken] = useState("")

  const models = PROVIDER_MODELS[provider] || []

  function handleProviderChange(p: Provider) {
    setProvider(p)
    const defaultModel = PROVIDER_MODELS[p].find((m) => m.fast)?.id || PROVIDER_MODELS[p][0].id
    setModel(defaultModel)
  }

  async function save() {
    await api(token).patch("/users/me", {
      provider,
      model,
      apiKey: apiKey || undefined,
      openaiApiKey: openaiKey || undefined,
      geminiApiKey: geminiKey || undefined,
    })
    onUpdate({ ...user, provider, model, api_key: apiKey, openai_api_key: openaiKey, gemini_api_key: geminiKey })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function generateRunnerToken() {
    const { data } = await api(token).post("/runner/token")
    setRunnerToken(data.token)
  }

  const select = "w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-3 py-2.5 text-sm outline-none focus:border-brand-accent"
  const input = "w-full bg-brand-bg border border-brand-border text-brand-text rounded-lg px-4 py-3 text-sm outline-none focus:border-brand-accent"
  const label = "block text-xs text-brand-muted uppercase tracking-wider mb-2"

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

      {/* API keys — show only the relevant one */}
      {provider === "anthropic" && (
        <section>
          <p className={label}>Anthropic API Key</p>
          <p className="text-xs text-brand-muted mb-3">Required for Pro+API tier. Starter and Pro use OrvitLab's pooled key.</p>
          <input type="password" className={input} placeholder="sk-ant-..." value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </section>
      )}

      {provider === "openai" && (
        <section>
          <p className={label}>OpenAI API Key</p>
          <p className="text-xs text-brand-muted mb-3">Your personal OpenAI key — jobs will run on your local runner.</p>
          <input type="password" className={input} placeholder="sk-..." value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} />
        </section>
      )}

      {provider === "gemini" && (
        <section>
          <p className={label}>Gemini API Key</p>
          <p className="text-xs text-brand-muted mb-3">Your Google AI Studio API key — jobs will run on your local runner.</p>
          <input type="password" className={input} placeholder="AIza..." value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} />
        </section>
      )}

      {provider === "ollama" && (
        <section className="bg-brand-surface border border-brand-border rounded-xl p-4">
          <p className="text-brand-text font-semibold text-sm mb-1">Ollama — Local Only</p>
          <p className="text-brand-muted text-xs">No API key needed. Make sure Ollama is running at <code className="text-brand-text">localhost:11434</code> and the selected model is pulled.</p>
        </section>
      )}

      <button
        className="bg-brand-accent text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-500 transition-colors"
        onClick={save}
      >
        {saved ? "Saved ✓" : "Save Settings"}
      </button>

      {/* Runner token */}
      <section>
        <p className={label}>Local Runner Token</p>
        <p className="text-xs text-brand-muted mb-3">Add to <code className="text-brand-text">runner/.env</code> or desktop app as <code className="text-brand-text">ORVITLAB_TOKEN</code>.</p>
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
          <span className="text-brand-text">{user.github_username}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
            user.tier === "free" ? "bg-zinc-700 text-zinc-300" : "bg-brand-accent text-white"
          }`}>{user.tier}</span>
        </div>
        {user.tokensThisMonth != null && (
          <p className="text-xs text-brand-muted mt-2">{user.tokensThisMonth.toLocaleString()} tokens used this month</p>
        )}
      </section>
    </div>
  )
}
