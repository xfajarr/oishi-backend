import "./lib/env.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agentsRouter } from "./routes/agents";
import { agentRunRouter } from "./routes/agent-run";
import { healthRouter } from "./routes/health";
import { lifiRouter } from "./routes/lifi";
import { authRouter } from "./routes/auth";
import { onchainRouter } from "./routes/onchain";
import { createLogger } from "./lib/logger";
import { getLlmDebugInfo } from "./llm/client";
import { loadFromSupabase } from "./services/agent-store";
import { startScheduler } from "./services/scheduler";

const logger = createLogger("server");

const app = new Hono();

// ── CORS (allow frontend on any origin for hackathon) ──────────────────
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-oishi-wallet", "x-oishi-signature", "x-oishi-message"],
  exposeHeaders: [],
  maxAge: 86400,
}));

// ── Routes (agentRunRouter first: its _scheduler route must beat agentsRouter's :id) ─
app.route("/api/health", healthRouter);
app.route("/api/lifi", lifiRouter);
app.route("/api/auth", authRouter);
app.route("/api/onchain", onchainRouter);
app.route("/api/agents", agentRunRouter);
app.route("/api/agents", agentsRouter);

// ── Root ───────────────────────────────────────────────────────────────
app.get("/", (c) =>
  c.json({
    name: "Oishi Agent Backend",
    version: "1.0.0",
    docs: "/api/health",
    endpoints: {
      auth: "/api/auth/login",
      onchain: "/api/onchain/register-agent/:id",
      lifiQuote: "/api/lifi/quote",
      agents: "/api/agents",
      run: "/api/agents/:id/run",
      chat: "/api/agents/:id/chat",
      context: "/api/agents/:id/context",
      decisions: "/api/agents/:id/decisions",
      skills: "/api/agents/:id/skills",
      strategies: "/api/agents/_strategies",
      scheduler: "/api/agents/_scheduler",
    },
  }),
);

// Load agents from Supabase (if configured) then start scheduler — runs on Vercel cold start too
void loadFromSupabase().then(() => {
  startScheduler();
});

// Vercel runs via api/[[...route]].ts + @hono/node-server/vercel handle. Local uses Node server.
export default app;

if (!process.env.VERCEL) {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`Oishi Agent Backend running on http://localhost:${info.port}`);
    logger.info(`LLM: ${getLlmDebugInfo()}`);
    logger.info(
      `Scheduler: waking active agents every ${parseInt(process.env.AGENT_CYCLE_MS ?? "60000", 10) / 1000}s`,
    );
  });
}
