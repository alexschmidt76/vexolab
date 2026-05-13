-- Phase 3 migrations
-- Run these in the Supabase SQL editor at supabase.com/dashboard

-- 1. Add tokens_used to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS tokens_used integer;

-- 2. Add expo_push_token to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS expo_push_token text;

-- 3. Expand tier column to support new tiers
--    If tier is currently an enum type, drop and recreate it.
--    If it is a plain text column with a check constraint, update the constraint.

-- Option A: plain text column with check constraint (most likely)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_tier_check;

ALTER TABLE users
  ADD CONSTRAINT users_tier_check
    CHECK (tier IN ('free', 'starter', 'pro', 'pro_api'));

-- 4. Create token_usage table for per-job token tracking
CREATE TABLE IF NOT EXISTS token_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tokens_used integer NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- index for fast per-user monthly queries
CREATE INDEX IF NOT EXISTS token_usage_user_id_created_at
  ON token_usage (user_id, created_at);
