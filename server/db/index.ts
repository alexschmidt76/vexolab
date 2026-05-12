import { createClient } from "@supabase/supabase-js"
import config from "../config/index"

export const db = createClient(config.supabaseUrl, config.supabaseServiceKey)
