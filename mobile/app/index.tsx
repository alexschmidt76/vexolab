import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native"
import axios from "axios"
import { Job } from "../../shared/types"

const API_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000"

export default function HomeScreen({ token, user }: { token: string; user: any }) {
  const [command, setCommand] = useState("")
  const [repo, setRepo] = useState("")
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const headers = { Authorization: `Bearer ${token}` }

  async function submitJob() {
    if (!command || !repo) return
    setError("")
    setLoading(true)
    try {
      const { data } = await axios.post(`${API_URL}/jobs`, { command, repo }, { headers })
      setJob(data)
      pollStatus(data.id)
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to submit job")
    } finally {
      setLoading(false)
    }
  }

  async function pollStatus(id: string) {
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API_URL}/jobs/${id}`, { headers })
        setJob(data)
        if (data.status === "done" || data.status === "failed") {
          clearInterval(interval)
        }
      } catch {
        clearInterval(interval)
      }
    }, 2000)
  }

  return (
    <ScrollView className="flex-1 bg-brand-bg" contentContainerStyle={{ padding: 24, justifyContent: "center", flexGrow: 1 }}>
      <Text className="text-brand-text text-3xl font-bold mb-1">VexoLab</Text>
      <Text className="text-brand-muted text-sm mb-8">
        @{user?.github_username} · {user?.tier}
      </Text>

      <TextInput
        className="bg-brand-surface text-brand-text p-4 rounded-xl mb-4 text-base"
        placeholder="What do you want to build?"
        placeholderTextColor="#71717a"
        value={command}
        onChangeText={setCommand}
        multiline
      />

      <TextInput
        className="bg-brand-surface text-brand-text p-4 rounded-xl mb-4 text-base"
        placeholder="owner/repo"
        placeholderTextColor="#71717a"
        value={repo}
        onChangeText={setRepo}
        autoCapitalize="none"
      />

      <Text className="text-brand-muted text-xs mb-4">
        Using <Text className="text-brand-text font-mono">{user?.model || "claude-sonnet-4-6"}</Text>
      </Text>

      {error ? <Text className="text-red-400 text-sm mb-3">{error}</Text> : null}

      <TouchableOpacity
        className="bg-brand-accent p-4 rounded-xl items-center mb-6"
        onPress={submitJob}
        disabled={loading || !command || !repo}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text className="text-white font-semibold text-base">Run Agent</Text>
        }
      </TouchableOpacity>

      {job && (
        <View className="bg-brand-surface p-4 rounded-xl">
          <Text className="text-brand-muted text-xs mb-1">Status</Text>
          <Text className={`font-semibold capitalize mb-2 ${
            job.status === "done" ? "text-green-400" :
            job.status === "failed" ? "text-red-400" :
            job.status === "running" ? "text-blue-400" :
            "text-yellow-400"
          }`}>{job.status}</Text>
          {job.model && (
            <Text className="text-brand-muted text-xs font-mono mb-2">{job.model}</Text>
          )}
          {job.branch && (
            <>
              <Text className="text-brand-muted text-xs mb-1">Branch</Text>
              <Text className="text-brand-accent text-sm mb-2">{job.branch}</Text>
            </>
          )}
          {job.prUrl && (
            <>
              <Text className="text-brand-muted text-xs mb-1">PR</Text>
              <Text className="text-brand-accent text-sm">{job.prUrl}</Text>
            </>
          )}
          {job.error && (
            <Text className="text-red-400 text-sm mt-2">{job.error}</Text>
          )}
        </View>
      )}
    </ScrollView>
  )
}
