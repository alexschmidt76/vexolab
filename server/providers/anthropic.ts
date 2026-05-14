import Anthropic from "@anthropic-ai/sdk"
import config from "../config/index"

export type AgentResult = { text: string; tokensUsed: number }

// run the ai agent with the given api key and model, return response with token count
export async function runAgent(
  command: string,
  apiKey?: string,
  model: string = "claude-sonnet-4-6",
  systemSuffix?: string
): Promise<AgentResult> {
  const client = new Anthropic({ apiKey: apiKey || config.anthropicKey })
  const baseSystem = `You are an AI developer agent. When given a command:
1. Describe what files to create or modify
2. Output the actual code changes
3. Suggest a git branch name (kebab-case, no spaces)

Respond ONLY in this exact JSON format with no extra text:
{
  "branch": "feature/branch-name",
  "summary": "what this change does",
  "files": [
    { "path": "src/components/Example.tsx", "content": "..." }
  ]
}`
  const response = await client.messages.create({
    model,
    max_tokens: 8096,
    system: systemSuffix ? `${baseSystem}\n\n## Repo-specific instructions:\n${systemSuffix}` : baseSystem,
    messages: [{ role: "user", content: command }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""
  const tokensUsed = response.usage.input_tokens + response.usage.output_tokens
  return { text, tokensUsed }
}
