import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, Linking, Alert } from "react-native"
import * as Notifications from "expo-notifications"
import axios from "axios"
import { PROVIDER_MODELS, Provider } from "../../shared/types"
import { useAuth } from "../lib/AuthContext"
import ProfileHeader from "../components/ProfileHeader"

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000"

type Tier = "starter" | "pro" | "pro_api"

const UPGRADE_PLANS: { tier: Tier; label: string; price: string; limit: string }[] = [
  { tier: "starter", label: "Starter", price: "$5/mo", limit: "100 jobs/month" },
  { tier: "pro", label: "Pro", price: "$10/mo", limit: "500 jobs/month" },
  { tier: "pro_api", label: "Pro + API Key", price: "$25/mo", limit: "Unlimited" },
]

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "GPT-4o (OpenAI)" },
  { id: "gemini", label: "Gemini (Google)" },
  { id: "ollama", label: "Ollama (Local)" },
]

export default function SettingsScreen() {
  const { token, user, logout, refreshUser } = useAuth()

  const [anthropicKey, setAnthropicKey] = useState("")
  const [openaiKey, setOpenaiKey] = useState("")
  const [geminiKey, setGeminiKey] = useState("")
  const [spendLimit, setSpendLimit] = useState(user?.spendLimitUsd?.toString() ?? "")
  const [slackWebhook, setSlackWebhook] = useState("")
  const [discordWebhook, setDiscordWebhook] = useState("")
  const [provider, setProvider] = useState<Provider>(user?.provider ?? "anthropic")
  const [model, setModel] = useState<string>(user?.model ?? PROVIDER_MODELS["anthropic"][1].id)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (user) {
      setProvider(user.provider ?? "anthropic")
      setModel(user.model ?? PROVIDER_MODELS["anthropic"][1].id)
      setSpendLimit(user.spendLimitUsd?.toString() ?? "")
    }
  }, [user])

  useEffect(() => {
    registerPushToken()
  }, [])

  function handleProviderChange(p: Provider) {
    setProvider(p)
    const defaultModel = PROVIDER_MODELS[p].find((m) => m.fast)?.id ?? PROVIDER_MODELS[p][0].id
    setModel(defaultModel)
  }

  async function registerPushToken() {
    if (!token) return
    try {
      const { status } = await Notifications.requestPermissionsAsync()
      if (status !== "granted") return
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync()
      await axios.post(
        `${SERVER_URL}/runner/push-token`,
        { expoPushToken },
        { headers: { Authorization: `Bearer ${token}` } }
      )
    } catch {}
  }

  async function saveSettings() {
    if (!token) return
    const body: Record<string, any> = { provider, model }
    if (anthropicKey.trim()) body.apiKey = anthropicKey.trim()
    if (openaiKey.trim()) body.openaiApiKey = openaiKey.trim()
    if (geminiKey.trim()) body.geminiApiKey = geminiKey.trim()
    if (spendLimit.trim()) {
      const parsed = parseFloat(spendLimit)
      if (!isNaN(parsed)) body.spendLimitUsd = parsed
    }
    await axios.patch(`${SERVER_URL}/users/me`, body, {
      headers: { Authorization: `Bearer ${token}` },
    })
    setAnthropicKey("")
    setOpenaiKey("")
    setGeminiKey("")
    await refreshUser()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveNotifications() {
    if (!token) return
    await axios.patch(
      `${SERVER_URL}/users/me/notifications`,
      {
        slackWebhookUrl: slackWebhook.trim() || null,
        discordWebhookUrl: discordWebhook.trim() || null,
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    setSlackWebhook("")
    setDiscordWebhook("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function upgrade(tier: Tier) {
    if (!token) return
    const { data } = await axios.post(
      `${SERVER_URL}/billing/checkout`,
      { tier },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    Linking.openURL(data.url)
  }

  async function getRunnerToken() {
    if (!token) return
    const { data } = await axios.post(
      `${SERVER_URL}/runner/token`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    )
    Alert.alert(
      "Runner Token",
      `${data.token}\n\nAdd this to your local runner .env as ORVITLAB_TOKEN`
    )
  }

  if (!user) return null

  const isCloud = user.tier !== "free"

  return (
    <ScrollView className="flex-1 bg-brand-bg">
      <ProfileHeader />

      <View className="p-6">
        <Text className="text-brand-text text-2xl font-bold mb-6">Settings</Text>

        {/* Provider selector */}
        <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">AI Provider</Text>
        <View className="bg-brand-surface rounded-xl mb-4 overflow-hidden">
          {PROVIDERS.map((p) => (
            <TouchableOpacity
              key={p.id}
              className={`px-4 py-3 border-b border-zinc-800 flex-row justify-between items-center ${provider === p.id ? "bg-indigo-950" : ""}`}
              onPress={() => handleProviderChange(p.id)}
            >
              <Text className={`text-sm ${provider === p.id ? "text-brand-accent font-semibold" : "text-brand-text"}`}>
                {p.label}
              </Text>
              {provider === p.id && <Text className="text-brand-accent text-sm">✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Model selector */}
        <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">Model</Text>
        <View className="bg-brand-surface rounded-xl mb-6 overflow-hidden">
          {PROVIDER_MODELS[provider].map((m) => (
            <TouchableOpacity
              key={m.id}
              className={`px-4 py-3 border-b border-zinc-800 flex-row justify-between items-center ${model === m.id ? "bg-indigo-950" : ""}`}
              onPress={() => setModel(m.id)}
            >
              <Text className={`text-sm flex-1 mr-2 ${model === m.id ? "text-brand-accent font-semibold" : "text-brand-text"}`}>
                {m.label}
              </Text>
              {model === m.id && <Text className="text-brand-accent text-sm">✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* API Keys */}
        <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">API Keys</Text>
        <View className="bg-brand-surface rounded-xl mb-1 overflow-hidden">
          <View className="px-4 py-3 border-b border-zinc-800">
            <Text className="text-brand-muted text-xs mb-1">
              Anthropic {user.hasAnthropicKey ? "✓ saved" : "not set"}
            </Text>
            <TextInput
              className="text-brand-text text-sm"
              placeholder="sk-ant-... (leave blank to keep existing)"
              placeholderTextColor="#71717a"
              value={anthropicKey}
              onChangeText={setAnthropicKey}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <View className="px-4 py-3 border-b border-zinc-800">
            <Text className="text-brand-muted text-xs mb-1">
              OpenAI {user.hasOpenAiKey ? "✓ saved" : "not set"}
            </Text>
            <TextInput
              className="text-brand-text text-sm"
              placeholder="sk-... (leave blank to keep existing)"
              placeholderTextColor="#71717a"
              value={openaiKey}
              onChangeText={setOpenaiKey}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <View className="px-4 py-3">
            <Text className="text-brand-muted text-xs mb-1">
              Gemini {user.hasGeminiKey ? "✓ saved" : "not set"}
            </Text>
            <TextInput
              className="text-brand-text text-sm"
              placeholder="AIza... (leave blank to keep existing)"
              placeholderTextColor="#71717a"
              value={geminiKey}
              onChangeText={setGeminiKey}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        </View>
        <Text className="text-brand-muted text-xs mb-6">Keys are stored encrypted. Only last 8 chars shown after saving.</Text>

        {/* Spend limit */}
        <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">Monthly Spend Limit (USD)</Text>
        <TextInput
          className="bg-brand-surface text-brand-text p-4 rounded-xl mb-1 text-sm"
          placeholder="e.g. 20 (no limit if blank)"
          placeholderTextColor="#71717a"
          value={spendLimit}
          onChangeText={setSpendLimit}
          keyboardType="decimal-pad"
        />
        <Text className="text-brand-muted text-xs mb-6">Stops new jobs once your API spend hits this amount.</Text>

        <TouchableOpacity
          className="bg-brand-accent p-3 rounded-xl items-center mb-8"
          onPress={saveSettings}
        >
          <Text className="text-white font-semibold">{saved ? "Saved ✓" : "Save Settings"}</Text>
        </TouchableOpacity>

        {/* Notifications */}
        <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">Notifications</Text>
        <View className="bg-brand-surface rounded-xl mb-1 overflow-hidden">
          <View className="px-4 py-3 border-b border-zinc-800">
            <Text className="text-brand-muted text-xs mb-1">Slack Webhook URL</Text>
            <TextInput
              className="text-brand-text text-sm"
              placeholder="https://hooks.slack.com/services/..."
              placeholderTextColor="#71717a"
              value={slackWebhook}
              onChangeText={setSlackWebhook}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View className="px-4 py-3">
            <Text className="text-brand-muted text-xs mb-1">Discord Webhook URL</Text>
            <TextInput
              className="text-brand-text text-sm"
              placeholder="https://discord.com/api/webhooks/..."
              placeholderTextColor="#71717a"
              value={discordWebhook}
              onChangeText={setDiscordWebhook}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
        <TouchableOpacity
          className="bg-zinc-700 p-3 rounded-xl items-center mb-6"
          onPress={saveNotifications}
        >
          <Text className="text-brand-text text-sm font-semibold">Save Notifications</Text>
        </TouchableOpacity>

        {/* Runner */}
        <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">Agent Runner</Text>
        {isCloud ? (
          <View className="bg-brand-surface p-4 rounded-xl mb-6">
            <Text className="text-brand-accent font-semibold mb-1">Cloud Runner Active</Text>
            <Text className="text-brand-muted text-sm">Jobs run on OrvitLab servers. Your computer can stay off.</Text>
          </View>
        ) : (
          <View className="bg-brand-surface p-4 rounded-xl mb-6">
            <Text className="text-brand-text font-semibold mb-1">Local Runner</Text>
            <Text className="text-brand-muted text-sm mb-3">Jobs run on your machine. Keep the runner app open.</Text>
            <TouchableOpacity className="bg-zinc-700 p-3 rounded-lg items-center" onPress={getRunnerToken}>
              <Text className="text-brand-text text-sm font-semibold">Get Runner Token</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upgrade plans */}
        {user.tier === "free" && (
          <>
            <Text className="text-brand-muted text-xs mb-3 uppercase tracking-wider">Upgrade Plan</Text>
            {UPGRADE_PLANS.map((plan) => (
              <TouchableOpacity
                key={plan.tier}
                className="bg-brand-surface border border-zinc-700 p-4 rounded-xl mb-3"
                onPress={() => upgrade(plan.tier)}
              >
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-brand-text font-bold">{plan.label}</Text>
                    <Text className="text-brand-muted text-xs mt-0.5">{plan.limit}</Text>
                  </View>
                  <View className="bg-brand-accent px-3 py-1.5 rounded-lg">
                    <Text className="text-white text-sm font-semibold">{plan.price}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Logout */}
        <TouchableOpacity
          className="border border-zinc-700 p-3 rounded-xl items-center mt-4 mb-8"
          onPress={logout}
        >
          <Text className="text-brand-muted font-semibold">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
