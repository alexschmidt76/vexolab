import Anthropic from "@anthropic-ai/sdk"
import config from "../config/index"

const client = new Anthropic({ apiKey: config.anthropicKey })

export async function runAgent(command: string): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: `You are an AI developer agent. When given a command:
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
}`,
    messages: [{ role: "user", content: command }],
  })

  return response.content[0].type === "text" ? response.content[0].text : ""
}
