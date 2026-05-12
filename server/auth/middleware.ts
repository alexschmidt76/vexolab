import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { db } from "../db/index"
import config from "../config/index"

// protect routes by requiring a valid jwt token in the authorization header
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  const token = authHeader.split(" ")[1]

  try {
    // verify the token and extract the user id
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string }

    // look up the user in the database and attach to the request
    const { data: user } = await db
      .from("users")
      .select("*")
      .eq("id", payload.userId)
      .single()

    if (!user) return res.status(401).json({ error: "User not found" })

    res.locals.user = user
    next()
  } catch {
    res.status(401).json({ error: "Invalid token" })
  }
}
