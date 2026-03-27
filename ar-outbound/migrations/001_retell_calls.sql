-- Retell AI call log table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS retell_calls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id TEXT UNIQUE NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('web_call', 'phone_call')),
  agent_id TEXT,
  direction TEXT DEFAULT 'outbound',
  from_number TEXT,
  to_number TEXT,
  status TEXT DEFAULT 'registered',
  duration_ms INTEGER,
  transcript TEXT,
  recording_url TEXT,
  call_analysis JSONB,
  disconnection_reason TEXT,
  metadata JSONB,
  initiated_by TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_retell_calls_call_id ON retell_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_retell_calls_created_at ON retell_calls(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retell_calls_status ON retell_calls(status);
CREATE INDEX IF NOT EXISTS idx_retell_calls_initiated_by ON retell_calls(initiated_by);
