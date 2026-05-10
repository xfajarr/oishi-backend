import { v4 as uuid } from "uuid";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type {
  Agent,
  AgentStatus,
  CommonRules,
  CreateAgentInput,
  SpecificRules,
  StrategyId,
} from "../models/agent";
import { DEFAULT_SPECIFIC, defaultCommonRules } from "../models/agent";

const DATA_DIR = join(import.meta.dirname, "..", "data");
const AGENTS_FILE = join(DATA_DIR, "agents.json");

// ── In-memory store ───────────────────────────────────────────────────
const agents = new Map<string, Agent>();

// ── Persistence ────────────────────────────────────────────────────────
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function saveToFile() {
  ensureDataDir();
  writeFileSync(AGENTS_FILE, JSON.stringify([...agents.values()], null, 2));
}

function loadFromFile() {
  try {
    if (!existsSync(AGENTS_FILE)) return;
    const raw = readFileSync(AGENTS_FILE, "utf-8");
    const data: Agent[] = JSON.parse(raw);
    for (const agent of data) agents.set(agent.id, agent);
    console.log(`[store] Loaded ${agents.size} agents from disk`);
  } catch (err) {
    console.warn("[store] Could not load agents:", err);
  }
}
loadFromFile();

// ── CRUD ───────────────────────────────────────────────────────────────
export function createAgent(
  owner: string,
  input: CreateAgentInput,
  kyaIdentityPda: string | null = null,
): Agent {
  const id = uuid();
  const now = Date.now();

  const specificDefaults = DEFAULT_SPECIFIC[input.strategyId] ?? {};
  const specificRules: SpecificRules = { ...specificDefaults, ...input.specificRules };

  const agent: Agent = {
    id,
    owner,
    handle: input.handle,
    displayName: input.displayName,
    strategyId: input.strategyId,
    commonRules: { ...defaultCommonRules, ...input.commonRules },
    specificRules,
    status: "active",
    kyaIdentityPda,
    kyaReputationScore: 0,
    attestationCount: 0,
    totalEarnings: 0,
    totalTxCount: 0,
    cycleCount: 0,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: null,
  };

  agents.set(id, agent);
  saveToFile();
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
  id: string,
  commonRules?: CommonRules,
  specificRules?: SpecificRules,
): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;

  if (commonRules) agent.commonRules = { ...agent.commonRules, ...commonRules };
  if (specificRules) agent.specificRules = { ...agent.specificRules, ...specificRules };
  agent.updatedAt = Date.now();

  agents.set(id, agent);
  saveToFile();
  return agent;
}

export function updateAgentStatus(id: string, status: AgentStatus): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;

  agent.status = status;
  agent.updatedAt = Date.now();
  if (status === "active") agent.lastActiveAt = Date.now();

  agents.set(id, agent);
  saveToFile();
  return agent;
}

export function updateAgentState(
  id: string,
  updates: Partial<
    Pick<Agent, "kyaReputationScore" | "attestationCount" | "totalEarnings" | "totalTxCount" | "cycleCount" | "lastActiveAt">
  >,
): Agent | null {
  const agent = agents.get(id);
  if (!agent) return null;

  Object.assign(agent, updates);
  agent.updatedAt = Date.now();

  agents.set(id, agent);
  // Don't save to file on every state update — save periodically via scheduler
  return agent;
}

export function persistAll() {
  saveToFile();
}

export function deleteAgent(id: string): boolean {
  const ok = agents.delete(id);
  if (ok) saveToFile();
  return ok;
}
