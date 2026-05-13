import "./global.css"
import { View, Text, TouchableOpacity, TextInput, Linking, ActivityIndicator } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import { AuthProvider, useAuth } from "./lib/AuthContext"
import HomeScreen from "./app/index"
import SettingsScreen from "./app/settings"
import { useState } from "react"

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000"

type Tab = "home" | "settings"

function LoginScreen() {
  const { login } = useAuth()
  const [value, setValue] = useState("")

  return (
    <View className="flex-1 bg-brand-bg items-center justify-center p-6">
      <Text className="text-brand-text text-4xl font-bold mb-2">OrvitLab</Text>
      <Text className="text-brand-muted text-sm mb-10">Command from anywhere</Text>

      <TouchableOpacity
        className="bg-brand-surface border border-zinc-700 px-6 py-4 rounded-xl mb-8 w-full items-center"
        onPress={() => Linking.openURL(`${SERVER_URL}/auth/github`)}
      >
        <Text className="text-brand-text font-semibold text-base">Continue with GitHub</Text>
      </TouchableOpacity>

      <Text className="text-brand-muted text-xs uppercase tracking-wider mb-2 self-start">
        Paste JWT token
      </Text>
      <TextInput
        className="w-full bg-brand-surface text-brand-text p-4 rounded-xl mb-3 text-sm"
        placeholder="Paste token from browser..."
        placeholderTextColor="#71717a"
        value={value}
        onChangeText={setValue}
        multiline
        numberOfLines={3}
      />
      <TouchableOpacity
        className="w-full bg-brand-accent p-4 rounded-xl items-center"
        onPress={() => value.trim() && login(value.trim())}
      >
        <Text className="text-white font-semibold">Sign In</Text>
      </TouchableOpacity>
    </View>
  )
}

function AppContent() {
  const { token, user, loading } = useAuth()
  const [tab, setTab] = useState<Tab>("home")

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-brand-bg items-center justify-center">
        <ActivityIndicator color="#6366f1" />
      </SafeAreaView>
    )
  }

  if (!token || !user) {
    return (
      <SafeAreaView className="flex-1 bg-brand-bg">
        <LoginScreen />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-brand-bg" edges={["top"]}>
      <View className="flex-1">
        {tab === "home" ? <HomeScreen token={token!} user={user} /> : <SettingsScreen />}
      </View>

      <View className="bg-brand-surface border-t border-zinc-800 flex-row pb-safe">
        {(["home", "settings"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            className="flex-1 py-3 items-center"
            onPress={() => setTab(t)}
          >
            <Text className={`text-xs font-semibold capitalize ${
              tab === t ? "text-brand-accent" : "text-brand-muted"
            }`}>
              {t}
            </Text>
            {tab === t && <View className="mt-1 w-4 h-0.5 bg-brand-accent rounded-full" />}
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
