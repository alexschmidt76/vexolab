import { useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from "react-native"
import axios from "axios"
import { Job } from "../../shared/types"

const API_URL = "http://localhost:3000"

export default function HomeScreen() {
  const [command, setCommand] = useState("")
  const [repo, setRepo] = useState("")
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(false)

  async function submitJob() {
    if (!command || !repo) return
    setLoading(true)
    try {
      const { data } = await axios.post(`${API_URL}/jobs`, { command, repo })
      setJob(data)
      pollStatus(data.id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function pollStatus(id: string) {
    const interval = setInterval(async () => {
      const { data } = await axios.get(`${API_URL}/jobs/${id}`)
      setJob(data)
      if (data.status === "done" || data.status === "failed") {
        clearInterval(interval)
      }
    }, 2000)
  }

  return (
    <View className="flex-1 bg-brand-bg p-6 justify-center">
      <Text className="text-brand-text text-3xl font-bold mb-1">OrvitLab</Text>
      <Text className="text-brand-muted text-sm mb-8">Command from anywhere</Text>

      <TextInput
        className="bg-brand-surface text-brand-text p-4 rounded-xl mb-4 text-base"
        placeholder="What do you want to build?"
        placeholderTextColor="#71717a"
        value={command}
        onChangeText={setCommand}
        multiline
      />

      <TextInput
        className="bg-brand-surface text-brand-text p-4 rounded-xl mb-6 text-base"
        placeholder="GitHub repo name"
        placeholderTextColor="#71717a"
        value={repo}
        onChangeText={setRepo}
      />

      <TouchableOpacity
        className="bg-brand-accent p-4 rounded-xl items-center mb-6"
        onPress={submitJob}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text className="text-white font-semibold text-base">Run Agent</Text>
        }
      </TouchableOpacity>

      {job && (
        <View className="bg-brand-surface p-4 rounded-xl">
          <Text className="text-brand-muted text-xs mb-1">Status</Text>
          <Text className="text-brand-text font-semibold capitalize mb-2">{job.status}</Text>
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
            <Text className="text-red-400 text-sm">{job.error}</Text>
          )}
        </View>
      )}
    </View>
  )
}
