import "./global.css"
import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, TextInput, Linking } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import axios from "axios"
import HomeScreen from "./app/index"
import SettingsScreen from "./app/settings"

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000"

type Tab = "home" | "settings"

function LoginScreen({ onLogin }: { onLogin: (t: string) => void }) {
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
        className="w-full bg-brand-accent p-4 rounded-xl items-center disabled:opacity-50"
        onPress={() => value.trim() && onLogin(value.trim())}
      >
        <Text className="text-white font-semibold">Sign In</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function App() {
  const [token, setToken] = useState("")
  const [user, setUser] = useState<any>(null)
  const [tab, setTab] = useState<Tab>("home")

  useEffect(() => {
    if (!token) return
    axios
      .get(`${SERVER_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setUser(r.data))
      .catch(() => {
        setToken("")
        setUser(null)
      })
  }, [token])

  if (!token || !user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-brand-bg">
          <LoginScreen onLogin={setToken} />
        </SafeAreaView>
      </SafeAreaProvider>
    )
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView className="flex-1 bg-brand-bg" edges={["top"]}>
        <View className="flex-1">
          {tab === "home" ? (
            <HomeScreen token={token} user={user} />
          ) : (
            <SettingsScreen token={token} user={user} />
          )}
        </View>

        {/* Tab bar */}
        <View className="bg-brand-surface border-t border-zinc-800 flex-row pb-safe">
          {(["home", "settings"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              className="flex-1 py-3 items-center"
              onPress={() => setTab(t)}
            >
              <Text
                className={`text-xs font-semibold capitalize ${
                  tab === t ? "text-brand-accent" : "text-brand-muted"
                }`}
              >
                {t}
              </Text>
              {tab === t && (
                <View className="mt-1 w-4 h-0.5 bg-brand-accent rounded-full" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
