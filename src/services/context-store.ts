/**
 * Context store — Supabase when available, JSON files as fallback.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { supabase, isSupabaseReady } from "../lib/supabase";
import { createLogger } from "../lib/logger";
import type { AgentContext, AgentMessage, AgentDecision, AgentState } from "../models/context";
import { createDefaultContext } from "../models/context";

const log = createLogger("context-store");

const DATA_DIR = join(import.meta.dirname, "..", "data");
const CONTEXTS_FILE = join(DATA_DIR, "contexts.json");
const contexts = new Map<string, AgentContext>();

// ── JSON fallback persistence ───────────────────────────────────────────
function ensureDataDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
function saveToFile() { ensureDataDir(); writeFileSync(CONTEXTS_FILE, JSON.stringify([...contexts.values()], null, 2)); }
function loadFromFile() {
  try {
    if (!existsSync(CONTEXTS_FILE)) return;
    for (const ctx of JSON.parse(readFileSync(CONTEXTS_FILE, "utf-8"))) contexts.set(ctx.agentId, ctx);
    log.info(`Loaded ${contexts.size} agent contexts from disk`);
  } catch (err) { log.warn("Could not load contexts", { error: String(err) }); }
}

// ── Init ────────────────────────────────────────────────────────────────
if (!isSupabaseReady()) {
  loadFromFile();
}

// ── CRUD ────────────────────────────────────────────────────────────────
export function initContext(agentId: string, systemPrompt: string): AgentContext {
  const ctx = createDefaultContext(agentId, systemPrompt);
  contexts.set(agentId, ctx);

  if (isSupabaseReady() && supabase) {
    supabase.from("agent_contexts").upsert({
      agent_id: agentId, session_id: ctx.sessionId, system_prompt: systemPrompt,
      messages: JSON.stringify(ctx.messages), decisions: JSON.stringify([]),
      state: JSON.stringify(ctx.state), memory: JSON.stringify({}),
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).then(() => {});
  }

  if (!isSupabaseReady()) saveToFile();
  return ctx;
}

export function getContext(agentId: string): AgentContext | undefined {
  return contexts.get(agentId);
}

export function addMessages(agentId: string, messages: AgentMessage[]): AgentContext | null {
  const ctx = contexts.get(agentId);
  if (!ctx) return null;
  ctx.messages.push(...messages);
  ctx.updatedAt = Date.now();
  contexts.set(agentId, ctx);
  return ctx;
}

export function addDecision(agentId: string, decision: AgentDecision): AgentContext | null {
  const ctx = contexts.get(agentId);
  if (!ctx) return null;
  ctx.decisions.push(decision);
  ctx.updatedAt = Date.now();

  if (isSupabaseReady() && supabase) {
    supabase.from("agent_contexts").update({
      decisions: JSON.stringify(ctx.decisions), updated_at: new Date().toISOString(),
    }).eq("agent_id", agentId).then(() => {});
  }

  contexts.set(agentId, ctx);
  return ctx;
}

export function updateState(agentId: string, state: Partial<AgentState>): AgentContext | null {
  const ctx = contexts.get(agentId);
  if (!ctx) return null;
  ctx.state = { ...ctx.state, ...state };
  ctx.updatedAt = Date.now();
  contexts.set(agentId, ctx);
  return ctx;
}

export function setMemory(agentId: string, key: string, value: unknown): AgentContext | null {
  const ctx = contexts.get(agentId);
  if (!ctx) return null;
  ctx.memory[key] = value;
  ctx.updatedAt = Date.now();
  contexts.set(agentId, ctx);
  return ctx;
}

export function deleteContext(agentId: string): boolean {
  const ok = contexts.delete(agentId);
  if (ok && isSupabaseReady() && supabase) {
    supabase.from("agent_contexts").delete().eq("agent_id", agentId).then(() => {});
  }
  if (ok && !isSupabaseReady()) saveToFile();
  return ok;
}

export function persistAll() {
  if (!isSupabaseReady()) saveToFile();
  // Supabase persists on every write (no need for periodic save)
}
