import { Router, Request, Response } from "express"
import axios from "axios"
import jwt from "jsonwebtoken"
import { db } from "../db/index"
import config from "../config/index"

const router = Router()

// redirect user to github to authorize the app
router.get("/github", (req: Request, res: Response) => {
  const platform = (req.query.platform as string) || ""
  const state = Buffer.from(JSON.stringify({ platform })).toString("base64url")
  const url = `https://github.com/login/oauth/authorize?client_id=${config.githubClientId}&scope=repo&state=${state}`
  res.redirect(url)
})

// github redirects back here with a code after the user authorizes
router.get("/github/callback", async (req: Request, res: Response) => {
  const { code, state } = req.query
  let platform = ""
  try {
    const decoded = JSON.parse(Buffer.from(state as string, "base64url").toString())
    platform = decoded.platform || ""
  } catch {}

  try {
    // exchange the code for a github access token
    const tokenRes = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
      },
      { headers: { Accept: "application/json" } }
    )
    const githubToken = tokenRes.data.access_token

    // get the github user's profile
    const userRes = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${githubToken}` },
    })
    const githubUser = userRes.data

    // create or update the user in the database
    const { data: user } = await db
      .from("users")
      .upsert(
        {
          github_id: String(githubUser.id),
          github_username: githubUser.login,
          github_token: githubToken,
        },
        { onConflict: "github_id" }
      )
      .select()
      .single()

    // sign a jwt token for the user
    const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
      expiresIn: "30d",
    })

    const dashboardUrl = process.env.DASHBOARD_URL || "https://app.vexolab.dev"

    if (platform === "web") {
      res.redirect(`${dashboardUrl}/login?token=${token}`)
    } else {
      res.send(`<pre style="font-size:14px;padding:20px">JWT Token (copy this):\n\n${token}</pre>`)
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
