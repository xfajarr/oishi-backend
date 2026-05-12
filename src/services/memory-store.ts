/**
 * Memory store — persistent memory + session history per agent.
 * Supabase when available, JSON files as fallback.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { v4 as uuid } from "uuid";
import { supabase, isSupabaseReady } from "../lib/supabase.js";
import { createLogger } from "../lib/logger.js";
import {
  type MemoryState,
  type MemoryEntry,
  type Session,
  type MemoryTag,
  createEmptyMemoryState,
} from "../models/agent-memory.js";

const log = createLogger("memory-store");

const DATA_DIR = join(import.meta.dirname, "..", "data");
const MEMORY_FILE = join(DATA_DIR, "memory.json");
const memories = new Map<string, MemoryState>();

function ensureDataDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
function saveToFile() { ensureDataDir(); writeFileSync(MEMORY_FILE, JSON.stringify([...memories.entries()], null, 2)); }
function loadFromFile() {
  try {
    if (!existsSync(MEMORY_FILE)) return;
    for (const [id, state] of JSON.parse(readFileSync(MEMORY_FILE, "utf-8"))) {
      memories.set(id, state);
    }
    log.info(`Loaded ${memories.size} memory states from disk`);
  } catch (err) { log.warn("Could not load memory", { error: String(err) }); }
}

if (!isSupabaseReady()) loadFromFile();

// ── State access ────────────────────────────────────────────────────────
export function getMemoryState(agentId: string): MemoryState {
  if (!memories.has(agentId)) {
    memories.set(agentId, createEmptyMemoryState(agentId));
  }
  return memories.get(agentId)!;
}

// ── Memory entries ──────────────────────────────────────────────────────
export function addMemoryEntry(
  agentId: string,
  content: string,
  tags: MemoryTag[] = ["fact"],
  importance = 5,
): MemoryEntry {
  const state = getMemoryState(agentId);
  const entry: MemoryEntry = {
    id: uuid(),
    agentId,
    content,
    tags,
    importance,
    recallCount: 0,
    lastRecalledAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  state.entries.push(entry);
  memories.set(agentId, state);
  if (!isSupabaseReady()) saveToFile();
  log.info(`Memory entry added for ${agentId}: ${content.slice(0, 60)}…`);
  return entry;
}

export function getMemoryEntries(agentId: string): MemoryEntry[] {
  return getMemoryState(agentId).entries;
}

export function updateMemoryEntry(
  agentId: string,
  entryId: string,
  updates: Partial<Pick<MemoryEntry, "content" | "tags" | "importance">>,
): MemoryEntry | null {
  const state = getMemoryState(agentId);
  const entry = state.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  if (updates.content !== undefined) entry.content = updates.content;
  if (updates.tags !== undefined) entry.tags = updates.tags;
  if (updates.importance !== undefined) entry.importance = updates.importance;
  entry.updatedAt = Date.now();
  memories.set(agentId, state);
  if (!isSupabaseReady()) saveToFile();
  return entry;
}

export function deleteMemoryEntry(agentId: string, entryId: string): boolean {
  const state = getMemoryState(agentId);
  const idx = state.entries.findIndex((e) => e.id === entryId);
  if (idx === -1) return false;
  state.entries.splice(idx, 1);
  memories.set(agentId, state);
  if (!isSupabaseReady()) saveToFile();
  return true;
}

// ── Sessions ────────────────────────────────────────────────────────────
export function startSession(
  agentId: string,
  label: string,
  initiator: Session["initiator"] = "owner",
): Session {
  const state = getMemoryState(agentId);

  // End any currently active session first
  if (state.activeSessionId) {
    endSession(agentId, state.activeSessionId);
  }

  const session: Session = {
    id: uuid(),
    agentId,
    label,
    initiator,
    startedAt: Date.now(),
    endedAt: null,
    turnCount: 0,
    summary: "",
    hadError: false,
  };

  state.sessions.push(session);
  state.activeSessionId = session.id;
  state.totalSessions++;
  memories.set(agentId, state);
  if (!isSupabaseReady()) saveToFile();

  log.info(`Session started for ${agentId}: ${label}`);
  return session;
}

export function incrementSessionTurn(agentId: string): void {
  const state = getMemoryState(agentId);
  if (!state.activeSessionId) return;
  const session = state.sessions.find((s) => s.id === state.activeSessionId);
  if (session) {
    session.turnCount++;
    memories.set(agentId, state);
  }
}

export function endSession(
  agentId: string,
  sessionId: string,
  summary = "",
  hadError = false,
): Session | null {
  const state = getMemoryState(agentId);
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  session.endedAt = Date.now();
  session.summary = summary;
  session.hadError = hadError;
  if (state.activeSessionId === sessionId) {
    state.activeSessionId = null;
  }
  memories.set(agentId, state);
  if (!isSupabaseReady()) saveToFile();
  log.info(`Session ended for ${agentId}: ${session.label}`);
  return session;
}

export function getSessions(agentId: string): Session[] {
  return getMemoryState(agentId).sessions.slice().reverse(); // newest first
}

export function getActiveSession(agentId: string): Session | null {
  const state = getMemoryState(agentId);
  if (!state.activeSessionId) return null;
  return state.sessions.find((s) => s.id === state.activeSessionId) ?? null;
}

// ── Auto-memory: distill a lesson from agent actions ──────────────────
// Called after each tool execution to build persistent memory.
export function autoRemember(
  agentId: string,
  action: string,
  outcome: "success" | "blocked" | "error",
  detail: string,
): void {
  let content: string;
  let tags: MemoryTag[];

  if (outcome === "blocked") {
    content = `Blocked from ${action}: ${detail}`;
    tags = ["lesson"];
  } else if (outcome === "error") {
    content = `Failed ${action}: ${detail}`;
    tags = ["lesson"];
  } else {
    content = `Successfully executed ${action}: ${detail}`;
    tags = ["fact", "milestone"];
  }

  // Only remember high-importance events automatically
  const importance = outcome === "blocked" ? 7 : outcome === "error" ? 8 : 3;
  addMemoryEntry(agentId, content, tags, importance);
}

// ── Persist all ─────────────────────────────────────────────────────────
export function persistAll() {
  if (!isSupabaseReady()) saveToFile();
}

// ── Delete all memory for an agent (rollback support) ──────────────────
export function deleteMemoryState(agentId: string): boolean {
  const existed = memories.has(agentId);
  memories.delete(agentId);
  if (existed && !isSupabaseReady()) saveToFile();
  return existed;
}
