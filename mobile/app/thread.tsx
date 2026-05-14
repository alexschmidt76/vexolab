import { useEffect, useRef, useState } from "react"
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native"
import axios from "axios"
import { JobThread, JobIteration } from "../../shared/types"

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || "http://localhost:3000"

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400",
  running: "text-blue-400",
  done: "text-green-400",
  failed: "text-red-400",
}

export default function ThreadScreen({
  threadId,
  token,
  onBack,
}: {
  threadId: string
  token: string
  onBack: () => void
}) {
  const [thread, setThread] = useState<JobThread | null>(null)
  const [iterations, setIterations] = useState<JobIteration[]>([])
  const [errorReport, setErrorReport] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const headers = { Authorization: `Bearer ${token}` }

  async function load() {
    const { data } = await axios.get(`${SERVER_URL}/threads/${threadId}`, { headers })
    setThread(data.thread)
    setIterations(data.iterations)
  }

  useEffect(() => {
    load()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    const active = iterations.some((i) => i.status === "pending" || i.status === "running")
    if (active && !pollRef.current) {
      pollRef.current = setInterval(load, 3000)
    } else if (!active && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [iterations])

  async function submitRepair() {
    if (!errorReport.trim()) return
    setSubmitting(true)
    try {
      await axios.post(`${SERVER_URL}/threads/${threadId}/repair`, { errorReport: errorReport.trim() }, { headers })
      setErrorReport("")
      load()
    } catch (err: any) {
      setWarning(err.response?.data?.error || "Repair failed")
    } finally {
      setSubmitting(false)
    }
  }

  async function resolve() {
    await axios.post(`${SERVER_URL}/threads/${threadId}/resolve`, {}, { headers })
    load()
  }

  if (!thread) {
    return (
      <View className="flex-1 bg-brand-bg items-center justify-center">
        <ActivityIndicator color="#6366f1" />
      </View>
    )
  }

  const isOpen = thread.status === "open"

  return (
    <ScrollView className="flex-1 bg-brand-bg">
      <View className="p-6">
        <TouchableOpacity onPress={onBack} className="mb-4">
          <Text className="text-brand-muted text-sm">← Back</Text>
        </TouchableOpacity>

        <Text className="text-brand-text text-xl font-bold mb-1">{thread.originalCommand}</Text>
        <Text className="text-brand-muted text-xs mb-1">
          {thread.repo} · {thread.iterationCount} attempt{thread.iterationCount !== 1 ? "s" : ""} · {thread.status}
        </Text>

        {/* Iteration history */}
        <View className="mt-4 space-y-3">
          {iterations.map((iter) => (
            <View key={iter.id} className="bg-brand-surface rounded-xl p-4 mb-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-brand-muted text-xs">Attempt #{iter.iterationNumber}</Text>
                <Text className={`text-xs font-semibold ${STATUS_COLOR[iter.status]}`}>{iter.status}</Text>
              </View>
              {iter.errorReport ? (
                <Text className="text-red-400 text-xs mb-2">Error: {iter.errorReport}</Text>
              ) : null}
              {iter.selfReview ? (
                <Text className="text-brand-muted text-xs mb-2">Review: {iter.selfReview}</Text>
              ) : null}
              {iter.buildOutput && !iter.buildOutput.includes("No issues") ? (
                <Text className="text-yellow-400 text-xs">{iter.buildOutput.slice(0, 120)}</Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Soft warning */}
        {warning ? (
          <View className="bg-yellow-900 rounded-xl p-4 mb-4">
            <Text className="text-yellow-300 text-sm">{warning}</Text>
            <TouchableOpacity onPress={() => setWarning(null)}>
              <Text className="text-yellow-500 text-xs mt-2">Dismiss</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Repair input */}
        {isOpen ? (
          <View className="mt-4">
            {thread.prUrl ? (
              <TouchableOpacity
                className="bg-green-800 p-4 rounded-xl items-center mb-4"
                onPress={resolve}
              >
                <Text className="text-green-200 font-semibold">Mark as Resolved ✓</Text>
              </TouchableOpacity>
            ) : null}

            <Text className="text-brand-muted text-xs mb-2 uppercase tracking-wider">Describe what's wrong</Text>
            <TextInput
              className="bg-brand-surface text-brand-text p-4 rounded-xl mb-4 text-sm"
              placeholder="e.g. The button doesn't appear on mobile..."
              placeholderTextColor="#71717a"
              value={errorReport}
              onChangeText={setErrorReport}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              className="bg-brand-accent p-4 rounded-xl items-center"
              onPress={submitRepair}
              disabled={submitting || !errorReport.trim()}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-white font-semibold">Request Repair</Text>
              }
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </ScrollView>
  )
}
