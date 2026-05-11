import Anthropic from "@anthropic-ai/sdk"
import dotenv from "dotenv"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, "../.env") })

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function runCommand(command) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [{ role: "user", content: command }],
  })
  return response.content[0].type === "text" ? response.content[0].text : ""
}
