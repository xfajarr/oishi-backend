import { Hono } from "hono";
import {
  createAgent,
  getAgent,
  getAgentsByOwner,
  getAllAgents,
  updateAgentRules,
  updateAgentStatus,
  deleteAgent,
} from "../services/agent-store.js";
import { initContext } from "../services/context-store.js";
import { buildSystemPrompt } from "../llm/prompts.js";
import {
  CreateAgentSchema,
  UpdateRulesSchema,
  STRATEGY_CONFIG,
  STRATEGY_IDS,
} from "../models/agent.js";
import { createLogger } from "../lib/logger.js";
import { requireAuth } from "../services/auth.js";
import type { OishiEnv } from "../types/hono-env.js";

const log = createLogger("agents");

export const agentsRouter = new Hono<OishiEnv>();

// ── PUBLIC: List all strategies ────────────────────────────────────────
agentsRouter.get("/_strategies", (c) => {
  const strategies = STRATEGY_IDS.map((id) => ({
    id,
    ...STRATEGY_CONFIG[id],
  }));
  return c.json({ strategies });
});

// ── Create agent ───────────────────────────────────────────────────────
agentsRouter.post("/", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const body = await c.req.json();

  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  // Check if handle is already taken
  const allAgents = getAllAgents();
  if (allAgents.some((a) => a.handle === parsed.data.handle)) {
    return c.json({ error: "Handle already taken" }, 409);
  }

  const agent = createAgent(wallet, parsed.data);

  // Initialize context with strategy-specific system prompt
  const prompt = buildSystemPrompt(
    agent.strategyId,
    agent.commonRules,
    agent.specificRules,
    { solBalance: 0, usdcBalance: 0, dailySpent: 0 },
  );
  initContext(agent.id, prompt);

  log.info(`Agent created: ${agent.handle}`, { strategy: agent.strategyId, wallet: wallet.slice(0, 6) + "..." });

  return c.json({ agent }, 201);
});

// ── List user's agents ─────────────────────────────────────────────────
agentsRouter.get("/", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const agents = getAgentsByOwner(wallet);
  return c.json({ agents, count: agents.length });
});

// ── Get agent by ID ────────────────────────────────────────────────────
agentsRouter.get("/:id", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  return c.json({ agent });
});

// ── Update agent rules ─────────────────────────────────────────────────
agentsRouter.put("/:id/rules", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const body = await c.req.json();
  const parsed = UpdateRulesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const updated = updateAgentRules(id, parsed.data.commonRules, parsed.data.specificRules);
  return c.json({ agent: updated });
});

// ── Pause agent ────────────────────────────────────────────────────────
agentsRouter.post("/:id/pause", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const updated = updateAgentStatus(id, "paused");
  return c.json({ agent: updated });
});

// ── Resume agent ───────────────────────────────────────────────────────
agentsRouter.post("/:id/resume", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const updated = updateAgentStatus(id, "active");
  return c.json({ agent: updated });
});

// ── Get agent wallet balance ─────────────────────────────────────────
agentsRouter.get("/:id/balance", requireAuth(), async (c) => {
  const wallet = (c as Record<string, unknown>).wallet as string;
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  try {
    const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");
    const pubkey = new PublicKey(agent.walletPublicKey);

    const solBalance = await connection.getBalance(pubkey);
    const sol = solBalance / 1e9;

    return c.json({
      agentId: id,
      wallet: agent.walletPublicKey,
      sol,
      solUsd: sol * 130, // approximate
      explorerUrl: `https://explorer.solana.com/address/${agent.walletPublicKey}?cluster=devnet`,
    });
  } catch (err) {
    return c.json({ error: `Failed to fetch balance: ${String(err)}` }, 500);
  }
});

// ── Withdraw / stop agent ──────────────────────────────────────────────
agentsRouter.delete("/:id", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  updateAgentStatus(id, "stopped");
  return c.json({ success: true });
});
