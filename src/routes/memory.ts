import { Hono } from "hono";
import { z } from "zod";
import { getAgent } from "../services/agent-store.js";
import {
  getMemoryState,
  addMemoryEntry,
  updateMemoryEntry,
  deleteMemoryEntry,
  getSessions,
  getActiveSession,
  startSession,
} from "../services/memory-store.js";
import { requireAuth } from "../services/auth.js";
import { ok, badRequest, notFound, forbidden, created } from "../lib/response.js";
import type { OishiEnv } from "../types/hono-env.js";
import { MemoryTagSchema } from "../models/agent-memory.js";

export const memoryRouter = new Hono<OishiEnv>();

const AddMemorySchema = z.object({
  content: z.string().min(1).max(500),
  tags: z.array(MemoryTagSchema).default(["fact"]),
  importance: z.number().min(1).max(10).default(5),
});

const UpdateMemorySchema = z.object({
  content: z.string().min(1).max(500).optional(),
  tags: z.array(MemoryTagSchema).optional(),
  importance: z.number().min(1).max(10).optional(),
});

const StartSessionSchema = z.object({
  label: z.string().min(1).max(100),
  initiator: z.enum(["owner", "scheduler", "agent"]).default("owner"),
});

function checkOwnership(c: { get: (k: string) => string }, id: string) {
  const wallet = c.get("wallet");
  const agent = getAgent(id);
  if (!agent) return { status: 404, message: "Agent not found" };
  if (agent.owner !== wallet) return { status: 403, message: "Not your agent" };
  return null;
}

// ── GET /api/memory/:id ───────────────────────────────────────────────
memoryRouter.get("/:id", requireAuth(), (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  const state = getMemoryState(id);
  const active = getActiveSession(id);

  return ok({
    entries: state.entries,
    activeSession: active,
    totalSessions: state.totalSessions,
  }, "Memory state retrieved");
});

// ── GET /api/memory/:id/memories ─────────────────────────────────────
memoryRouter.get("/:id/memories", requireAuth(), (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  const { entries } = getMemoryState(id);
  const tag = c.req.query("tag");
  const filtered = tag ? entries.filter((e) => e.tags.includes(tag as any)) : entries;
  const sorted = filtered.slice().sort((a, b) => b.updatedAt - a.updatedAt);

  return ok({ entries: sorted, total: sorted.length, filterTag: tag ?? null }, "Memory entries retrieved");
});

// ── POST /api/memory/:id/memories ─────────────────────────────────────
memoryRouter.post("/:id/memories", requireAuth(), async (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  let body: z.infer<typeof AddMemorySchema>;
  try {
    body = AddMemorySchema.parse(await c.req.json());
  } catch {
    return badRequest("Invalid memory entry — { content: string, tags?: string[], importance?: 1-10 }");
  }

  const entry = addMemoryEntry(id, body.content, body.tags, body.importance);
  return created({ entry }, "Memory entry added");
});

// ── PATCH /api/memory/:id/memories/:entryId ──────────────────────────
memoryRouter.patch("/:id/memories/:entryId", requireAuth(), async (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  const entryId = c.req.param("entryId");
  let body: z.infer<typeof UpdateMemorySchema>;
  try {
    body = UpdateMemorySchema.parse(await c.req.json());
  } catch {
    return badRequest("Invalid update — { content?, tags?, importance? }");
  }

  const entry = updateMemoryEntry(id, entryId, body);
  if (!entry) return notFound("Memory entry not found");

  return ok({ entry }, "Memory entry updated");
});

// ── DELETE /api/memory/:id/memories/:entryId ─────────────────────────
memoryRouter.delete("/:id/memories/:entryId", requireAuth(), (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  const entryId = c.req.param("entryId");
  const ok2 = deleteMemoryEntry(id, entryId);
  if (!ok2) return notFound("Memory entry not found");

  return ok({ success: true }, "Memory entry deleted");
});

// ── GET /api/memory/:id/sessions ─────────────────────────────────────
memoryRouter.get("/:id/sessions", requireAuth(), (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  const sessions = getSessions(id);
  const active = getActiveSession(id);

  return ok({ sessions, activeSession: active, totalSessions: sessions.length }, "Sessions retrieved");
});

// ── POST /api/memory/:id/sessions ─────────────────────────────────────
memoryRouter.post("/:id/sessions", requireAuth(), async (c) => {
  const err = checkOwnership(c, c.req.param("id"));
  if (err) return notFound(err.message);

  const id = c.req.param("id");
  let body: z.infer<typeof StartSessionSchema>;
  try {
    body = StartSessionSchema.parse(await c.req.json());
  } catch {
    return badRequest("Invalid session — { label: string, initiator?: \"owner\"|\"scheduler\"|\"agent\" }");
  }

  const session = startSession(id, body.label, body.initiator);
  return created({ session }, "Session started");
});
