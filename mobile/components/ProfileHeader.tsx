import { View, Text } from "react-native"
import { useAuth } from "../lib/AuthContext"

export default function ProfileHeader() {
  const { user } = useAuth()
  if (!user) return null

  const tierColor =
    user.tier === "pro_api" ? "bg-brand-accent text-white" :
    user.tier === "pro" ? "bg-indigo-900 text-indigo-200" :
    user.tier === "starter" ? "bg-zinc-600 text-zinc-200" :
    "bg-zinc-700 text-zinc-300"

  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-zinc-800">
      <View className="flex-row items-center gap-3">
        <Text className="text-brand-text font-semibold">@{user.githubUsername}</Text>
        <View className={`px-2 py-0.5 rounded-full ${tierColor}`}>
          <Text className="text-xs font-semibold uppercase">
            {user.tier === "pro_api" ? "Pro+API" : user.tier}
          </Text>
        </View>
      </View>
      {user.tier === "free" && !user.hasAnthropicKey && (
        <Text className="text-brand-muted text-xs">{user.freePromptsRemaining} prompts left</Text>
      )}
    </View>
  )
}
