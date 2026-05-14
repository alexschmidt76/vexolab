import { exec } from "child_process"
import { promisify } from "util"
import fs from "fs/promises"
import path from "path"
import crypto from "crypto"
import config from "../config/index"

const execAsync = promisify(exec)

export type BuildCheckResult = {
  passed: boolean
  output: string
}

export async function runBuildCheck(
  files: { path: string; content: string }[]
): Promise<BuildCheckResult> {
  const sandboxId = crypto.randomUUID()
  const sandboxPath = path.join(config.sandboxDir, sandboxId)

  try {
    await fs.mkdir(sandboxPath, { recursive: true })

    for (const file of files) {
      const filePath = path.join(sandboxPath, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, file.content)
    }

    await fs.writeFile(
      path.join(sandboxPath, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          module: "CommonJS",
          strict: false,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ["**/*.ts", "**/*.tsx"],
      })
    )

    const { stdout, stderr } = await execAsync("npx tsc --noEmit 2>&1", {
      cwd: sandboxPath,
      timeout: 30000,
    })

    const output = (stdout + stderr).trim()
    const passed = !output.includes("error TS")
    return { passed, output: output || "No issues found" }
  } catch (err: any) {
    return {
      passed: false,
      output: err.stdout || err.message || "Build check failed",
    }
  } finally {
    await fs.rm(sandboxPath, { recursive: true, force: true })
  }
}
