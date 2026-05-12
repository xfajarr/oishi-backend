import { Hono } from "hono";
import { z } from "zod";
import { getAgent } from "../services/agent-store.js";
import { getContext } from "../services/context-store.js";
import { getSkillsForStrategy } from "../models/skill.js";
import { triggerAgentNow, getSchedulerStats } from "../services/scheduler.js";
import { requireAuth } from "../services/auth.js";
import { ok, badRequest, notFound, forbidden, serverError } from "../lib/response.js";
import { runAgentChat } from "../llm/agent-loop.js";
import type { OishiEnv } from "../types/hono-env.js";

export const agentRunRouter = new Hono<OishiEnv>();

// ── PUBLIC: Scheduler status ───────────────────────────────────────────
agentRunRouter.get("/_scheduler", (c) => {
  const stats = getSchedulerStats();
  return c.json(stats);
});

const chatBodySchema = z.object({
  message: z.string().min(1).max(8000),
});

// ── Chat (LLM turn from app) — register before generic :id routes if needed ──
agentRunRouter.post("/:id/chat", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  let body: z.infer<typeof chatBodySchema>;
  try {
    body = chatBodySchema.parse(await c.req.json());
  } catch {
    return c.json({ error: "Invalid JSON body (expected { \"message\": string })" }, 400);
  }

  const result = await runAgentChat(id, body.message);
  if (result.error) {
    const status = result.error.startsWith("LLM error") ? 502 : 400;
    return c.json({ error: result.error }, status);
  }
  return c.json({ reply: result.reply });
});

// ── Force-trigger agent cycle ──────────────────────────────────────────
agentRunRouter.post("/:id/run", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");
  if (agent.status !== "active") return c.json({ error: `Agent is ${agent.status} — resume it first` }, 400);

  const result = await triggerAgentNow(id);
  return c.json(result);
});

// ── Get agent context (memory) ─────────────────────────────────────────
agentRunRouter.get("/:id/context", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

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
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  const context = getContext(id);
  if (!context) return c.json({ error: "No context initialized" }, 404);

  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const decisions = context.decisions.slice(-limit).reverse();

  return c.json({ decisions, total: context.decisions.length });
});

// ── Get agent skills ───────────────────────────────────────────────────
agentRunRouter.get("/:id/skills", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  const skills = getSkillsForStrategy(agent.strategyId);
  return c.json({ skills, strategyId: agent.strategyId });
});
