import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

export default {
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  githubToken: process.env.GITHUB_TOKEN!,
  githubUsername: process.env.GITHUB_USERNAME!,
  port: process.env.PORT || 3000,
}
