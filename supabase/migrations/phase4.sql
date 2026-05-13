-- Phase 4 migrations
-- Run these in the Supabase SQL editor at supabase.com/dashboard

-- 1. Add new API key columns and model preference to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS openai_api_key text,
  ADD COLUMN IF NOT EXISTS gemini_api_key text,
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'claude-sonnet-4-6';

-- 2. Add trigger, provider, and model to jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS trigger text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'claude-sonnet-4-6';

-- 3. Webhook configs table
CREATE TABLE IF NOT EXISTS webhook_configs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  repo       text NOT NULL,
  secret     text NOT NULL,
  events     text[] NOT NULL DEFAULT ARRAY['push'],
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, repo)
);
