import { Hono } from "hono";
import { getAgent } from "../services/agent-store";
import { getContext } from "../services/context-store";
import { getSkillsForStrategy } from "../models/skill";
import { triggerAgentNow, getSchedulerStats } from "../services/scheduler";
import { requireAuth } from "../services/auth";

export const agentRunRouter = new Hono();

// ── PUBLIC: Scheduler status ───────────────────────────────────────────
agentRunRouter.get("/_scheduler", (c) => {
  const stats = getSchedulerStats();
  return c.json(stats);
});

// ── Force-trigger agent cycle ──────────────────────────────────────────
agentRunRouter.post("/:id/run", requireAuth(), async (c) => {
  const wallet = (c as Record<string, unknown>).wallet as string;
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  if (agent.status !== "active") return c.json({ error: `Agent is ${agent.status} — resume it first` }, 400);

  const result = await triggerAgentNow(id);
  return c.json(result);
});

// ── Get agent context (memory) ─────────────────────────────────────────
agentRunRouter.get("/:id/context", requireAuth(), (c) => {
  const wallet = (c as Record<string, unknown>).wallet as string;
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const context = getContext(id);
  if (!context) return c.json({ error: "No context initialized" }, 404);

  return c.json({
    agentId: context.agentId,
    sessionId: context.sessionId,
    state: context.state,
    memory: context.memory,
    decisionCount: context.decisions.length,
    messageCount: context.messages.length,
    updatedAt: context.updatedAt,
  });
});

// ── Get agent decisions (activity log) ─────────────────────────────────
agentRunRouter.get("/:id/decisions", requireAuth(), (c) => {
  const wallet = (c as Record<string, unknown>).wallet as string;
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const context = getContext(id);
  if (!context) return c.json({ error: "No context initialized" }, 404);

  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const decisions = context.decisions.slice(-limit).reverse();

  return c.json({ decisions, total: context.decisions.length });
});

// ── Get agent skills ───────────────────────────────────────────────────
agentRunRouter.get("/:id/skills", requireAuth(), (c) => {
  const wallet = (c as Record<string, unknown>).wallet as string;
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const skills = getSkillsForStrategy(agent.strategyId);
  return c.json({ skills, strategyId: agent.strategyId });
});
