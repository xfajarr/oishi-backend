import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentContext, AgentMessage, AgentDecision, AgentState } from "../models/context";
import { createDefaultContext } from "../models/context";

const DATA_DIR = join(import.meta.dirname, "..", "data");
const CONTEXTS_FILE = join(DATA_DIR, "contexts.json");

// ── In-memory store ───────────────────────────────────────────────────
const contexts = new Map<string, AgentContext>();

// ── Persistence ────────────────────────────────────────────────────────
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function saveToFile() {
  ensureDataDir();
  writeFileSync(CONTEXTS_FILE, JSON.stringify([...contexts.values()], null, 2));
}

function loadFromFile() {
  try {
    if (!existsSync(CONTEXTS_FILE)) return;
    const raw = readFileSync(CONTEXTS_FILE, "utf-8");
    const data: AgentContext[] = JSON.parse(raw);
    for (const ctx of data) contexts.set(ctx.agentId, ctx);
    console.log(`[context] Loaded ${contexts.size} agent contexts from disk`);
  } catch (err) {
    console.warn("[context] Could not load contexts:", err);
  }
}
loadFromFile();

// ── CRUD ───────────────────────────────────────────────────────────────
export function initContext(agentId: string, systemPrompt: string): AgentContext {
  const ctx = createDefaultContext(agentId, systemPrompt);
  contexts.set(agentId, ctx);
  saveToFile();
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
  if (ok) saveToFile();
  return ok;
}

export function persistAll() {
  saveToFile();
}
