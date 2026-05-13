import { useState, useEffect } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, Linking, Alert } from "react-native"
import * as Notifications from "expo-notifications"
import axios from "axios"
import { PROVIDER_MODELS, Provider } from "../../shared/types"

const SERVER_URL = "http://localhost:3000"

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

export default function SettingsScreen({ token, user }: { token: string; user: any }) {
  const [apiKey, setApiKey] = useState(user.api_key || "")
  const [provider, setProvider] = useState<Provider>(user.provider || "anthropic")
  const [model, setModel] = useState<string>(user.model || PROVIDER_MODELS["anthropic"][1].id)
  const [saved, setSaved] = useState(false)

  function handleProviderChange(p: Provider) {
    setProvider(p)
    const defaultModel = PROVIDER_MODELS[p].find((m) => m.fast)?.id || PROVIDER_MODELS[p][0].id
    setModel(defaultModel)
  }

  // register for push notifications on mount
  useEffect(() => {
    registerPushToken()
  }, [])

  async function registerPushToken() {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== "granted") return

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync()
    await axios.post(
      `${SERVER_URL}/runner/push-token`,
      { expoPushToken },
      { headers: { Authorization: `Bearer ${token}` } }
    )
  }

  async function saveSettings() {
    await axios.patch(`${SERVER_URL}/users/me`, {
      apiKey: apiKey || undefined,
      provider,
      model,
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function upgrade(tier: Tier) {
    const { data } = await axios.post(`${SERVER_URL}/billing/checkout`, { tier }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    Linking.openURL(data.url)
  }

  async function getRunnerToken() {
    const { data } = await axios.post(`${SERVER_URL}/runner/token`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    })
    Alert.alert(
      "Runner Token",
      `${data.token}\n\nAdd this to your local runner .env as ORVITLAB_TOKEN`
    )
  }

  const isCloud = user.tier !== "free"

  return (
    <ScrollView className="flex-1 bg-brand-bg p-6">
      <Text className="text-brand-text text-2xl font-bold mb-6">Settings</Text>

      <View className="bg-brand-surface p-4 rounded-xl mb-6 flex-row justify-between items-center">
        <Text className="text-brand-text font-semibold">{user.github_username}</Text>
        <View className={`px-3 py-1 rounded-full ${isCloud ? "bg-brand-accent" : "bg-zinc-700"}`}>
          <Text className="text-white text-xs font-semibold uppercase">{user.tier}</Text>
        </View>
      </View>

      {/* Provider selector */}
      <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">AI Provider</Text>
      <View className="bg-brand-surface rounded-xl mb-4 overflow-hidden">
        {PROVIDERS.map((p) => (
          <TouchableOpacity
            key={p.id}
            className={`px-4 py-3 border-b border-zinc-800 flex-row justify-between items-center ${provider === p.id ? "bg-brand-accent/20" : ""}`}
            onPress={() => handleProviderChange(p.id)}
          >
            <Text className={`text-sm ${provider === p.id ? "text-brand-accent font-semibold" : "text-brand-text"}`}>{p.label}</Text>
            {provider === p.id && <Text className="text-brand-accent text-sm">✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* Model selector */}
      <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">Model</Text>
      <View className="bg-brand-surface rounded-xl mb-4 overflow-hidden">
        {PROVIDER_MODELS[provider].map((m) => (
          <TouchableOpacity
            key={m.id}
            className={`px-4 py-3 border-b border-zinc-800 flex-row justify-between items-center ${model === m.id ? "bg-brand-accent/20" : ""}`}
            onPress={() => setModel(m.id)}
          >
            <Text className={`text-sm flex-1 mr-2 ${model === m.id ? "text-brand-accent font-semibold" : "text-brand-text"}`}>{m.label}</Text>
            {model === m.id && <Text className="text-brand-accent text-sm">✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* API key — only relevant for pro_api tier with Anthropic */}
      {user.tier === "pro_api" && provider === "anthropic" && (
        <>
          <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">
            Anthropic API Key
          </Text>
          <TextInput
            className="bg-brand-surface text-brand-text p-4 rounded-xl mb-2 text-sm"
            placeholder="sk-ant-..."
            placeholderTextColor="#71717a"
            value={apiKey}
            onChangeText={setApiKey}
            secureTextEntry
          />
        </>
      )}

      <TouchableOpacity
        className="bg-brand-accent p-3 rounded-xl items-center mb-8"
        onPress={saveSettings}
      >
        <Text className="text-white font-semibold">
          {saved ? "Saved ✓" : "Save Settings"}
        </Text>
      </TouchableOpacity>

      <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">
        Agent Runner
      </Text>
      {isCloud ? (
        <View className="bg-brand-surface p-4 rounded-xl mb-6">
          <Text className="text-brand-accent font-semibold mb-1">Cloud Runner Active</Text>
          <Text className="text-brand-muted text-sm">Jobs run on OrvitLab servers. Your computer can stay off.</Text>
        </View>
      ) : (
        <View className="bg-brand-surface p-4 rounded-xl mb-6">
          <Text className="text-brand-text font-semibold mb-1">Local Runner</Text>
          <Text className="text-brand-muted text-sm mb-3">Jobs run on your machine. Keep the runner app open.</Text>
          <TouchableOpacity
            className="bg-zinc-700 p-3 rounded-lg items-center"
            onPress={getRunnerToken}
          >
            <Text className="text-brand-text text-sm font-semibold">Get Runner Token</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* upgrade section — shown only if not on a paid plan */}
      {user.tier === "free" && (
        <>
          <Text className="text-brand-muted text-xs mb-3 uppercase tracking-wider">
            Upgrade Plan
          </Text>
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
    </ScrollView>
  )
}
