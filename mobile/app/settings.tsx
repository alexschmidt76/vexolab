import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, Linking, Alert } from "react-native"
import axios from "axios"

const SERVER_URL = "http://localhost:3000"

export default function SettingsScreen({ token, user }: { token: string; user: any }) {
  const [apiKey, setApiKey] = useState(user.api_key || "")
  const [saved, setSaved] = useState(false)

  async function saveApiKey() {
    await axios.patch(`${SERVER_URL}/users/me`, { apiKey }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function upgrade() {
    const { data } = await axios.post(`${SERVER_URL}/billing/checkout`, {}, {
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

  return (
    <ScrollView className="flex-1 bg-brand-bg p-6">
      <Text className="text-brand-text text-2xl font-bold mb-6">Settings</Text>

      <View className="bg-brand-surface p-4 rounded-xl mb-6 flex-row justify-between items-center">
        <Text className="text-brand-text font-semibold">{user.github_username}</Text>
        <View className={`px-3 py-1 rounded-full ${user.tier === "pro" ? "bg-brand-accent" : "bg-zinc-700"}`}>
          <Text className="text-white text-xs font-semibold uppercase">{user.tier}</Text>
        </View>
      </View>

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
      <TouchableOpacity
        className="bg-brand-accent p-3 rounded-xl items-center mb-8"
        onPress={saveApiKey}
      >
        <Text className="text-white font-semibold">
          {saved ? "Saved ✓" : "Save API Key"}
        </Text>
      </TouchableOpacity>

      <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">
        Agent Runner
      </Text>
      {user.tier === "pro" ? (
        <View className="bg-brand-surface p-4 rounded-xl mb-4">
          <Text className="text-brand-accent font-semibold mb-1">Cloud Runner Active</Text>
          <Text className="text-brand-muted text-sm">Jobs run on OrvitLab servers. Your computer can stay off.</Text>
        </View>
      ) : (
        <View className="bg-brand-surface p-4 rounded-xl mb-4">
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

      {user.tier === "free" && (
        <TouchableOpacity
          className="bg-brand-accent p-4 rounded-xl items-center mt-2"
          onPress={upgrade}
        >
          <Text className="text-white font-bold text-base">Upgrade to Pro — $10/mo</Text>
          <Text className="text-indigo-200 text-xs mt-1">Cloud runner + no setup required</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}
