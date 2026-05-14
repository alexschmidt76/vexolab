import { runAgent as anthropicAgent } from "./anthropic"
import { runAgent as openaiAgent } from "./openai"
import { runAgent as geminiAgent } from "./gemini"
import { runAgent as ollamaAgent } from "./ollama"
import { Provider, PROVIDER_MODELS } from "../../shared/types"

function getDefaultModel(provider: Provider): string {
  const models = PROVIDER_MODELS[provider]
  return models.find((m) => m.fast)?.id || models[0].id
}

// run the agent for the given provider and return a JSON string with the result + metadata
export async function runAgent(
  command: string,
  provider: Provider,
  apiKey: string,
  model?: string,
  repoConfig?: string | null
): Promise<string> {
  const resolvedModel = model || getDefaultModel(provider)
  const systemSuffix = repoConfig || undefined
  let text: string
  let tokensUsed: number

  switch (provider) {
    case "openai": {
      const result = await openaiAgent(command, apiKey, resolvedModel, systemSuffix)
      text = result.text
      tokensUsed = result.tokensUsed
      break
    }
    case "gemini": {
      const result = await geminiAgent(command, apiKey, resolvedModel, systemSuffix)
      text = result.text
      tokensUsed = result.tokensUsed
      break
    }
    case "ollama": {
      const result = await ollamaAgent(command, resolvedModel, systemSuffix)
      text = result.text
      tokensUsed = result.tokensUsed
      break
    }
    case "anthropic":
    default: {
      const result = await anthropicAgent(command, apiKey, resolvedModel, systemSuffix)
      text = result.text
      tokensUsed = result.tokensUsed
      break
    }
  }

  const parsed = JSON.parse(text.replace(/```json|```/g, "").trim())
  return JSON.stringify({ ...parsed, tokensUsed, model: resolvedModel })
}
