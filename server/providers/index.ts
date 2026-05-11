import { runAgent as anthropicAgent } from "./anthropic"
import { Provider } from "../../shared/types"

export async function runAgent(
  command: string,
  provider: Provider = "anthropic"
): Promise<string> {
  switch (provider) {
    case "anthropic":
      return anthropicAgent(command)
    // case "openai": return openaiAgent(command)  // add later
    // case "gemini": return geminiAgent(command)  // add later
    default:
      return anthropicAgent(command)
  }
}
