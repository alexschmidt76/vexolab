import { runAgent as anthropicAgent } from "./anthropic"
import { Provider } from "../../shared/types"

export async function runAgent(
  command: string,
  provider: Provider = "anthropic",
  apiKey?: string
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return anthropicAgent(command, apiKey)
    // case "openai": return openaiAgent(command, apiKey)
    // case "gemini": return geminiAgent(command, apiKey)
    default:
      return anthropicAgent(command, apiKey)
  }
}
