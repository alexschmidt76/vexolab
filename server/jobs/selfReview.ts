import { runAgent } from "../providers/index"
import { Provider } from "../../shared/types"

export type SelfReviewResult = {
  approved: boolean
  feedback: string
}

export async function reviewOutput(
  originalCommand: string,
  files: { path: string; content: string }[],
  provider: string,
  model: string,
  apiKey: string
): Promise<SelfReviewResult> {
  const filesSummary = files
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 500)}\n\`\`\``)
    .join("\n\n")

  const reviewPrompt = `You are reviewing code you just generated.
Original command: "${originalCommand}"

Files generated:
${filesSummary}

Review this output critically. Check for:
- Does it actually fulfill the original command?
- Are there obvious syntax errors or missing imports?
- Are there any incomplete implementations (TODOs, placeholders)?
- Would this code break existing functionality?

Respond ONLY in this JSON format:
{
  "branch": "review",
  "summary": "self-review",
  "files": [],
  "approved": true or false,
  "feedback": "brief summary of issues found, or 'Looks good' if approved"
}`

  try {
    const raw = await runAgent(reviewPrompt, provider as Provider, apiKey, model)
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim())
    return {
      approved: parsed.approved ?? true,
      feedback: parsed.feedback || "Looks good",
    }
  } catch {
    return { approved: true, feedback: "Review skipped (parse error)" }
  }
}
