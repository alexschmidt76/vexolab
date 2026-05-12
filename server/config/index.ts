import dotenv from "dotenv"
dotenv.config({ path: "../.env" })

export default {
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  githubToken: process.env.GITHUB_TOKEN!,
  githubUsername: process.env.GITHUB_USERNAME!,
  githubClientId: process.env.GITHUB_CLIENT_ID!,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET!,
  jwtSecret: process.env.JWT_SECRET!,
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY!,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  stripeProPriceId: process.env.STRIPE_PRO_PRICE_ID!,
  runnerPollInterval: parseInt(process.env.RUNNER_POLL_INTERVAL_MS || "5000"),
  port: process.env.PORT || 3000,
  serverUrl: process.env.SERVER_URL || "http://localhost:3000",
}
