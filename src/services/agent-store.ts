/**
 * Agent store — Supabase when available, JSON files as fallback.
 * Interface is identical regardless of backend.
 */
import { v4 as uuid } from "uuid";
import { Keypair } from "@solana/web3.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { supabase, isSupabaseReady } from "../lib/supabase.js";
import { createLogger } from "../lib/logger.js";
import type {
  Agent,
  AgentStatus,
  CommonRules,
  CreateAgentInput,
  SpecificRules,
} from "../models/agent.js";
import { DEFAULT_SPECIFIC, defaultCommonRules } from "../models/agent.js";

const log = createLogger("agent-store");

const DATA_DIR = join(import.meta.dirname, "..", "data");
const AGENTS_FILE = join(DATA_DIR, "agents.json");
const agents = new Map<string, Agent>();

// ── JSON fallback persistence ───────────────────────────────────────────
function ensureDataDir() { if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true }); }
function saveToFile() { ensureDataDir(); writeFileSync(AGENTS_FILE, JSON.stringify([...agents.values()], null, 2)); }
function loadFromFile() {
  try {
    if (!existsSync(AGENTS_FILE)) return;
    for (const a of JSON.parse(readFileSync(AGENTS_FILE, "utf-8"))) agents.set(a.id, a);
    log.info(`Loaded ${agents.size} agents from disk`);
  } catch (err) { log.warn("Could not load agents", { error: String(err) }); }
}

// ── Init ────────────────────────────────────────────────────────────────
if (!isSupabaseReady()) {
  loadFromFile();
  log.info("Using JSON file storage");
} else {
  log.info("Using Supabase storage");
}

// ── Supabase row ↔ Agent ───────────────────────────────────────────────
function rowToAgent(row: Record<string, unknown>): Agent {
  return {
    id: row.id as string,
    owner: row.owner as string,
    handle: row.handle as string,
    displayName: row.display_name as string,
    strategyId: row.strategy_id as Agent["strategyId"],
    commonRules: (row.common_rules ?? defaultCommonRules) as CommonRules,
    specificRules: (row.specific_rules ?? {}) as SpecificRules,
    status: row.status as AgentStatus,
    kyaIdentityPda: row.kya_identity_pda as string | null,
    kyaReputationScore: row.kya_reputation as number,
    attestationCount: row.attestations as number,
    totalEarnings: row.total_earnings as number,
    totalTxCount: row.total_tx_count as number,
    cycleCount: row.cycle_count as number,
    walletPublicKey:
      typeof row.wallet_public_key === "string" && row.wallet_public_key.length > 0
        ? row.wallet_public_key
        : "",
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at as string).getTime() : null,
  };
}

function agentToRow(a: Agent) {
  return {
    owner: a.owner,
    handle: a.handle,
    display_name: a.displayName,
    strategy_id: a.strategyId,
    common_rules: a.commonRules,
    specific_rules: a.specificRules,
    status: a.status,
    kya_identity_pda: a.kyaIdentityPda,
    kya_reputation: a.kyaReputationScore,
    attestations: a.attestationCount,
    total_earnings: a.totalEarnings,
    total_tx_count: a.totalTxCount,
    cycle_count: a.cycleCount,
    last_active_at: a.lastActiveAt ? new Date(a.lastActiveAt).toISOString() : null,
  };
}

// ── CRUD ───────────────────────────────────────────────────────────────
export function createAgent(
  owner: string,
  input: CreateAgentInput,
  kyaIdentityPda: string | null = null,
): Agent {
  const id = uuid();
  const now = Date.now();
  const specificDefaults = DEFAULT_SPECIFIC[input.strategyId] ?? {};

  // Generate agent's own Solana wallet
  const walletKeypair = Keypair.generate();
  const walletPublicKey = walletKeypair.publicKey.toBase58();

  const agent: Agent = {
    id, owner, handle: input.handle, displayName: input.displayName,
    strategyId: input.strategyId,
    commonRules: { ...defaultCommonRules, ...input.commonRules },
    specificRules: { ...specificDefaults, ...input.specificRules },
    status: "active", kyaIdentityPda, kyaReputationScore: 0, attestationCount: 0,
    totalEarnings: 0, totalTxCount: 0, cycleCount: 0,
    walletPublicKey,
    createdAt: now, updatedAt: now, lastActiveAt: null,
  };
  log.info(`Agent wallet created: ${walletPublicKey.slice(0, 8)}...`);

  if (isSupabaseReady() && supabase) {
    supabase.from("agents").insert({ id, ...agentToRow(agent), created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }).then(() => {});
  }

  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}

export function createDraftAgent(
  owner: string,
  input: CreateAgentInput,
): Agent {
  const id = uuid();
  const now = Date.now();
  const specificDefaults = DEFAULT_SPECIFIC[input.strategyId] ?? {};

  const agent: Agent = {
    id, owner, handle: input.handle, displayName: input.displayName,
    strategyId: input.strategyId,
    commonRules: { ...defaultCommonRules, ...input.commonRules },
    specificRules: { ...specificDefaults, ...input.specificRules },
    status: "draft",
    kyaIdentityPda: null,
    kyaReputationScore: 0, attestationCount: 0,
    totalEarnings: 0, totalTxCount: 0, cycleCount: 0,
    walletPublicKey: "",
    createdAt: now, updatedAt: now, lastActiveAt: null,
  };

  if (isSupabaseReady() && supabase) {
    supabase.from("agents").insert({ id, ...agentToRow(agent), created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }).then(() => {});
  }
  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}

export function upgradeDraftWithOnChain(
  id: string, walletPublicKey: string, kyaIdentityPda: string,
): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;
  if (agent.status !== "draft") return null;
  agent.status = "active";
  agent.walletPublicKey = walletPublicKey;
  agent.kyaIdentityPda = kyaIdentityPda;
  agent.updatedAt = Date.now();
  agent.lastActiveAt = Date.now();
  if (isSupabaseReady() && supabase) {
    supabase.from("agents").update({ status: "active", wallet_public_key: walletPublicKey, kya_identity_pda: kyaIdentityPda, updated_at: new Date().toISOString(), last_active_at: new Date().toISOString() }).eq("id", id).then(() => {});
  }
  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function getAgentsByOwner(owner: string): Agent[] {
  return [...agents.values()].filter((a) => a.owner === owner);
}

export function getActiveAgents(): Agent[] {
  return [...agents.values()].filter((a) => a.status === "active");
}

export function getAllAgents(): Agent[] {
  return [...agents.values()];
}

export function updateAgentRules(
  id: string, commonRules?: CommonRules, specificRules?: SpecificRules,
): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;
  if (commonRules) agent.commonRules = { ...agent.commonRules, ...commonRules };
  if (specificRules) agent.specificRules = { ...agent.specificRules, ...specificRules };
  agent.updatedAt = Date.now();

  if (isSupabaseReady() && supabase) {
    supabase.from("agents").update({ common_rules: agent.commonRules, specific_rules: agent.specificRules, updated_at: new Date().toISOString() }).eq("id", id).then(() => {});
  }

  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}

export function updateAgentStatus(id: string, status: AgentStatus): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;
  agent.status = status;
  agent.updatedAt = Date.now();
  if (status === "active") agent.lastActiveAt = Date.now();

  if (isSupabaseReady() && supabase) {
    supabase.from("agents").update({ status, last_active_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).then(() => {});
  }

  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}

export function updateAgentState(
  id: string,
  updates: Partial<Pick<Agent, "kyaReputationScore" | "attestationCount" | "totalEarnings" | "totalTxCount" | "cycleCount" | "lastActiveAt">>,
): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;
  Object.assign(agent, updates);
  agent.updatedAt = Date.now();
  agents.set(id, agent);
  return agent;
}

// ── Load all agents from Supabase into memory on startup ───────────────
export async function loadFromSupabase(): Promise<Agent[]> {
  if (!isSupabaseReady() || !supabase) {
    return getAllAgents();
  }
  const { data, error } = await supabase.from("agents").select("*");
  if (error) {
    log.error("Failed to load agents from Supabase", { error: error.message });
    return getAllAgents();
  }
  const rows = data ?? [];
  for (const row of rows) {
    agents.set(row.id as string, rowToAgent(row as Record<string, unknown>));
  }
  log.info(`Loaded ${agents.size} agents from Supabase`);
  return getAllAgents();
}

export function persistAll() {
  if (!isSupabaseReady()) saveToFile();
}

export function markAgentPaid(id: string, amountSol: number): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;
  agent.updatedAt = Date.now();
  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}

export function deleteAgent(id: string): boolean {
  const ok = agents.delete(id);
  if (ok && isSupabaseReady() && supabase) {
    supabase.from("agents").delete().eq("id", id).then(() => {});
  }
  if (ok && !isSupabaseReady()) saveToFile();
  return ok;
}
