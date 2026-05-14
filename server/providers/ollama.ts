import axios from "axios"
import config from "../config/index"

export type AgentResult = { text: string; tokensUsed: number }

// run the agent using a local ollama instance — no api key required
export async function runAgent(
  command: string,
  model: string = "codellama",
  systemSuffix?: string
): Promise<AgentResult> {
  const repoInstructions = systemSuffix ? `\n\n## Repo-specific instructions:\n${systemSuffix}` : ""
  const response = await axios.post(`${config.ollamaBaseUrl}/api/generate`, {
    model,
    prompt: `You are an AI developer agent. Respond ONLY in this exact JSON format with no extra text:
{
  "branch": "feature/branch-name",
  "summary": "what this change does",
  "files": [
    { "path": "src/components/Example.tsx", "content": "..." }
  ]
}${repoInstructions}

Command: ${command}`,
    stream: false,
  })

  return {
    text: response.data.response,
    tokensUsed: response.data.eval_count || 0,
  }
}
