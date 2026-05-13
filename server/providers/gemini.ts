import { GoogleGenerativeAI } from "@google/generative-ai"

export type AgentResult = { text: string; tokensUsed: number }

// run the agent using gemini and return the response with token count
export async function runAgent(
  command: string,
  apiKey: string,
  model: string = "gemini-1.5-flash"
): Promise<AgentResult> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const genModel = genAI.getGenerativeModel({ model })

  const prompt = `You are an AI developer agent. Respond ONLY in this exact JSON format with no extra text:
{
  "branch": "feature/branch-name",
  "summary": "what this change does",
  "files": [
    { "path": "src/components/Example.tsx", "content": "..." }
  ]
}

Command: ${command}`

  const result = await genModel.generateContent(prompt)
  const text = result.response.text()
  const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0
  return { text, tokensUsed }
}
