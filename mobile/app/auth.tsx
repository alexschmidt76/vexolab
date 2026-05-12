import { View, Text, TouchableOpacity, Linking } from "react-native"

const SERVER_URL = "http://localhost:3000"

export default function AuthScreen() {
  function loginWithGitHub() {
    Linking.openURL(`${SERVER_URL}/auth/github`)
  }

  return (
    <View className="flex-1 bg-brand-bg items-center justify-center p-6">
      <Text className="text-brand-text text-4xl font-bold mb-2">OrvitLab</Text>
      <Text className="text-brand-muted text-sm mb-12">Command from anywhere</Text>

      <TouchableOpacity
        className="bg-brand-surface border border-zinc-700 px-6 py-4 rounded-xl flex-row items-center gap-3"
        onPress={loginWithGitHub}
      >
        <Text className="text-brand-text font-semibold text-base">
          Continue with GitHub
        </Text>
      </TouchableOpacity>
    </View>
  )
}
