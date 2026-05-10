-- Oishi Agent Backend — Supabase Schema
-- Run this in your Supabase SQL Editor to create the tables.

-- ── Agents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner           TEXT NOT NULL,
  handle          TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  strategy_id     TEXT NOT NULL,
  common_rules    JSONB NOT NULL DEFAULT '{}',
  specific_rules  JSONB NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped', 'blocked')),
  kya_identity_pda TEXT,
  kya_reputation   INTEGER NOT NULL DEFAULT 0,
  attestations    INTEGER NOT NULL DEFAULT 0,
  total_earnings  REAL NOT NULL DEFAULT 0,
  total_tx_count  INTEGER NOT NULL DEFAULT 0,
  cycle_count     INTEGER NOT NULL DEFAULT 0,
  last_active_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agents_owner ON agents(owner);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_handle ON agents(handle);

-- ── Agent Contexts (memory, messages, decisions, state) ────────────────
CREATE TABLE IF NOT EXISTS agent_contexts (
  agent_id        UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  session_id      UUID NOT NULL DEFAULT gen_random_uuid(),
  system_prompt   TEXT NOT NULL DEFAULT '',
  messages        JSONB NOT NULL DEFAULT '[]',
  decisions       JSONB NOT NULL DEFAULT '[]',
  state           JSONB NOT NULL DEFAULT '{}',
  memory          JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Auto-update updated_at ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agents_updated
  BEFORE UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_contexts_updated
  BEFORE UPDATE ON agent_contexts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ── Row Level Security (backend service key bypasses RLS) ──────────────
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_contexts ENABLE ROW LEVEL SECURITY;
