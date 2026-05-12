/**
 * Soul store — agent personality, backstory, goals, and identity.
 * Supabase when available, JSON files as fallback.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { supabase, isSupabaseReady } from "../lib/supabase.js";
import { createLogger } from "../lib/logger.js";
import {
  type AgentSoul,
  type SoulTraits,
  defaultSoul,
} from "../models/agent-soul.js";

const log = createLogger("soul-store");

const DATA_DIR = join(import.meta.dirname, "..", "data");
const SOULS_FILE = join(DATA_DIR, "souls.json");
const souls = new Map<string, AgentSoul>();

function ensureDataDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
function saveToFile() { ensureDataDir(); writeFileSync(SOULS_FILE, JSON.stringify([...souls.entries()], null, 2)); }
function loadFromFile() {
  try {
    if (!existsSync(SOULS_FILE)) return;
    for (const [id, soul] of JSON.parse(readFileSync(SOULS_FILE, "utf-8"))) {
      souls.set(id, soul);
    }
    log.info(`Loaded ${souls.size} agent souls from disk`);
  } catch (err) { log.warn("Could not load souls", { error: String(err) }); }
}

if (!isSupabaseReady()) loadFromFile();

export function getSoul(agentId: string): AgentSoul | null {
  return souls.get(agentId) ?? null;
}

export function createSoul(agentId: string, overrides: Partial<AgentSoul> = {}): AgentSoul {
  const soul: AgentSoul = {
    agentId,
    ...defaultSoul,
    ...overrides,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  souls.set(agentId, soul);
  if (!isSupabaseReady()) saveToFile();
  log.info(`Soul created for agent ${agentId}`);
  return soul;
}

export function updateSoul(
  agentId: string,
  updates: Partial<{
    backstory: string;
    goals: string;
    boundaries: string;
    selfName: string;
    avatarSeed: string;
    traits: SoulTraits;
    communicationStyle: { useEmoji: boolean; useSlang: boolean; language: "en" | "mixed" };
    updatedAt: number;
  }>,
): AgentSoul | null {
  const existing = souls.get(agentId);
  if (!existing) return null;
  const updated: AgentSoul = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };
  souls.set(agentId, updated);
  if (!isSupabaseReady()) saveToFile();
  log.info(`Soul updated for agent ${agentId}`);
  return updated;
}

export function updateSoulTraits(
  agentId: string,
  traits: Partial<SoulTraits>,
): AgentSoul | null {
  const existing = souls.get(agentId);
  if (!existing) return null;
  return updateSoul(agentId, {
    traits: { ...existing.traits, ...traits },
  });
}

export function deleteSoul(agentId: string): boolean {
  const ok = souls.delete(agentId);
  if (ok && !isSupabaseReady()) saveToFile();
  return ok;
}

export function persistAll() {
  if (!isSupabaseReady()) saveToFile();
}
