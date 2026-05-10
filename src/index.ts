import "./lib/env";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agentsRouter } from "./routes/agents";
import { agentRunRouter } from "./routes/agent-run";
import { healthRouter } from "./routes/health";
import { lifiRouter } from "./routes/lifi";
import { createLogger } from "./lib/logger";
import { startScheduler } from "./services/scheduler";

const logger = createLogger("server");

const app = new Hono();

// ── CORS (allow frontend on any origin for hackathon) ──────────────────
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "x-oishi-wallet", "x-oishi-signature", "x-oishi-message"],
  exposeHeaders: [],
  maxAge: 86400,
}));

// ── Routes (agentRunRouter first: its _scheduler route must beat agentsRouter's :id) ─
app.route("/api/health", healthRouter);
app.route("/api/lifi", lifiRouter);
app.route("/api/agents", agentRunRouter);
app.route("/api/agents", agentsRouter);

// ── Root ───────────────────────────────────────────────────────────────
app.get("/", (c) =>
  c.json({
    name: "Oishi Agent Backend",
    version: "1.0.0",
    docs: "/api/health",
    endpoints: {
      lifiQuote: "/api/lifi/quote",
      agents: "/api/agents",
      run: "/api/agents/:id/run",
      context: "/api/agents/:id/context",
      decisions: "/api/agents/:id/decisions",
      skills: "/api/agents/:id/skills",
      strategies: "/api/agents/_strategies",
      scheduler: "/api/agents/_scheduler",
    },
  }),
);

// ── Start ──────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? "3001", 10);

serve({ fetch: app.fetch, port }, (info) => {
  logger.info(`Oishi Agent Backend running on http://localhost:${info.port}`);
  logger.info(`LLM: ${process.env.LLM_MODEL ?? "gpt-4o"} @ ${process.env.LLM_BASE_URL ?? "api.openai.com/v1"}`, { model: process.env.LLM_MODEL, baseUrl: process.env.LLM_BASE_URL });

  // Start the agent scheduler
  startScheduler();
  logger.info(`Scheduler: waking active agents every ${parseInt(process.env.AGENT_CYCLE_MS ?? "60000", 10) / 1000}s`);
});
