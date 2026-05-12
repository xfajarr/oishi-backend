import { Hono } from "hono";
import { z } from "zod";
import { getSoul, createSoul, updateSoul, updateSoulTraits, deleteSoul } from "../services/soul-store.js";
import { getAgent } from "../services/agent-store.js";
import { requireAuth } from "../services/auth.js";
import { ok, badRequest, notFound, forbidden, created } from "../lib/response.js";
import type { OishiEnv } from "../types/hono-env.js";
import { SoulTraitsSchema } from "../models/agent-soul.js";

export const soulRouter = new Hono<OishiEnv>();

const UpdateSoulSchema = z.object({
  backstory: z.string().max(500).optional(),
  goals: z.string().max(300).optional(),
  boundaries: z.string().max(300).optional(),
  selfName: z.string().max(20).optional(),
  avatarSeed: z.string().max(20).optional(),
  traits: SoulTraitsSchema.optional(),
  communicationStyle: z.object({
    useEmoji: z.boolean().optional(),
    useSlang: z.boolean().optional(),
    language: z.enum(["en", "mixed"]).optional(),
  }).optional(),
});

// ── GET /api/soul/:id ─────────────────────────────────────────────────
soulRouter.get("/:id", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  const soul = getSoul(id);
  return ok({ soul }, soul ? "Soul retrieved" : "No soul configured for this agent");
});

// ── PUT /api/soul/:id ──────────────────────────────────────────────────
soulRouter.put("/:id", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  let body: z.infer<typeof UpdateSoulSchema>;
  try {
    body = UpdateSoulSchema.parse(await c.req.json());
  } catch {
    return badRequest("Invalid soul configuration");
  }

  let soul = getSoul(id);
  if (!soul) {
    soul = createSoul(id);
  }

  const updated = updateSoul(id, {
    ...body,
    communicationStyle: soul.communicationStyle,
  });
  return ok({ soul: updated }, "Soul updated");
});

// ── PATCH /api/soul/:id/traits ─────────────────────────────────────────
soulRouter.patch("/:id/traits", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  let body: z.infer<typeof SoulTraitsSchema>;
  try {
    body = SoulTraitsSchema.parse(await c.req.json());
  } catch {
    return badRequest("Invalid traits — check disposition, verbosity, tone, reasoning, riskAppetite, and focus");
  }

  let soul = getSoul(id);
  if (!soul) soul = createSoul(id);

  const updated = updateSoulTraits(id, body);
  return ok({ soul: updated }, "Soul traits updated");
});

// ── DELETE /api/soul/:id ───────────────────────────────────────────────
soulRouter.delete("/:id", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return notFound("Agent not found");
  if (agent.owner !== wallet) return forbidden("Not your agent");

  deleteSoul(id);
  return ok({ success: true }, "Soul reset to defaults");
});
