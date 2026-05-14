import { createClient } from "@supabase/supabase-js"
import config from "../config/index"

export const db = createClient(config.supabaseUrl, config.supabaseServiceKey)

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

export function camel<T>(obj: Record<string, any> | null): T | null {
  if (!obj) return null
  const out: Record<string, any> = {}
  for (const key of Object.keys(obj)) {
    out[snakeToCamel(key)] = obj[key]
  }
  return out as T
}
