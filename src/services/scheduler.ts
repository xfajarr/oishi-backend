import { getActiveAgents, persistAll } from "./agent-store";
import { persistAll as persistContexts } from "./context-store";
import { runAgentCycle } from "../llm/agent-loop";

// ── Scheduler configuration ────────────────────────────────────────────
const CYCLE_INTERVAL_MS = parseInt(process.env.AGENT_CYCLE_MS ?? "60000", 10); // default 60s
const PERSIST_INTERVAL_MS = parseInt(process.env.PERSIST_MS ?? "30000", 10); // default 30s

let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let persistTimer: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

// ── Stats ──────────────────────────────────────────────────────────────
export interface SchedulerStats {
  running: boolean;
  cycleIntervalMs: number;
  persistIntervalMs: number;
  activeAgents: number;
  totalCycles: number;
  lastCycleAt: number | null;
  cyclesByAgent: Record<string, number>;
}

const stats: SchedulerStats = {
  running: false,
  cycleIntervalMs: CYCLE_INTERVAL_MS,
  persistIntervalMs: PERSIST_INTERVAL_MS,
  activeAgents: 0,
  totalCycles: 0,
  lastCycleAt: null,
  cyclesByAgent: {},
};

// ── Main cycle: wake all active agents ─────────────────────────────────
async function tickAllAgents() {
  if (isRunning) return; // prevent overlapping cycles
  isRunning = true;

  try {
    const agents = getActiveAgents();
    stats.activeAgents = agents.length;

    if (agents.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`[scheduler] Waking ${agents.length} active agents...`);

    // Run agents in parallel but throttle concurrency
    const batchSize = 5;
    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((agent) =>
          runAgentCycle(agent.id).then((result) => {
            stats.totalCycles++;
            stats.cyclesByAgent[agent.handle] = (stats.cyclesByAgent[agent.handle] ?? 0) + 1;
            return { handle: agent.handle, result };
          }),
        ),
      );

      for (const r of results) {
        if (r.status === "rejected") {
          console.error("[scheduler] Agent cycle failed:", r.reason);
        } else if (!r.value.result.success) {
          console.warn(`[scheduler] ${r.value.handle}: ${r.value.result.error}`);
        } else {
          const { action, blocked, blockReason } = r.value.result;
          if (blocked) {
            console.log(`[scheduler] ${r.value.handle}: ${action} → BLOCKED (${blockReason})`);
          } else {
            console.log(`[scheduler] ${r.value.handle}: ${action ?? "observed"}`);
          }
        }
      }
    }

    stats.lastCycleAt = Date.now();
  } catch (err) {
    console.error("[scheduler] Cycle failed:", err);
  } finally {
    isRunning = false;
  }
}

// ── Persistence tick ───────────────────────────────────────────────────
function persistAllData() {
  persistAll();
  persistContexts();
}

// ── Start / Stop ───────────────────────────────────────────────────────
export function startScheduler() {
  if (schedulerTimer) return;

  console.log(`[scheduler] Starting — cycle: ${CYCLE_INTERVAL_MS / 1000}s, persist: ${PERSIST_INTERVAL_MS / 1000}s`);

  // Run first cycle immediately on start
  tickAllAgents();

  schedulerTimer = setInterval(tickAllAgents, CYCLE_INTERVAL_MS);
  persistTimer = setInterval(persistAllData, PERSIST_INTERVAL_MS);

  stats.running = true;
}

export function stopScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  if (persistTimer) clearInterval(persistTimer);
  schedulerTimer = null;
  persistTimer = null;
  stats.running = false;

  // Final persist
  persistAllData();
  console.log("[scheduler] Stopped");
}

export function getSchedulerStats(): SchedulerStats {
  return { ...stats };
}

export async function triggerAgentNow(agentId: string) {
  return runAgentCycle(agentId);
}
