import OpenAI from "openai"

export type AgentResult = { text: string; tokensUsed: number }

// run the agent using openai and return the response with token count
export async function runAgent(
  command: string,
  apiKey: string,
  model: string = "gpt-4o-mini"
): Promise<AgentResult> {
  const client = new OpenAI({ apiKey })

  const response = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are an AI developer agent. When given a command:
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
      },
      { role: "user", content: command },
    ],
  })

  const text = response.choices[0]?.message?.content || ""
  const tokensUsed =
    (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0)
  return { text, tokensUsed }
}
