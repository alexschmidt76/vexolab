-- Phase 3.5 migrations
-- Run these in the Supabase SQL editor at supabase.com/dashboard

-- 1. Add provider preference to users (missing from phase4.sql)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'anthropic';

-- 2. Runner tokens table (used by local runner authentication)
CREATE TABLE IF NOT EXISTS runner_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
