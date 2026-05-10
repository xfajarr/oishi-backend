import "./lib/env.js";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agentsRouter } from "./routes/agents.js";
import { agentRunRouter } from "./routes/agent-run.js";
import { healthRouter } from "./routes/health.js";
import { lifiRouter } from "./routes/lifi.js";
import { authRouter } from "./routes/auth.js";
import { onchainRouter } from "./routes/onchain.js";
import { createLogger } from "./lib/logger.js";
import { getLlmDebugInfo } from "./llm/client.js";
import { loadFromSupabase } from "./services/agent-store.js";
import { startScheduler } from "./services/scheduler.js";

const logger = createLogger("server");
const app = new Hono();

// ── CORS (allow frontend) ─────────────────────────────────────────────────
app.use("*", cors({
  origin: [
    "https://oishiapp.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  credentials: true,
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-oishi-wallet", "x-oishi-signature", "x-oishi-message"],
  exposeHeaders: [],
  maxAge: 86400,
}));

// ── Routes ──────────────────────────────────────────────────────────────────
app.route("/api/health", healthRouter);
app.route("/api/lifi", lifiRouter);
app.route("/api/auth", authRouter);
app.route("/api/onchain", onchainRouter);
app.route("/api/agents", agentRunRouter);
app.route("/api/agents", agentsRouter);

// ── Debug endpoint ─────────────────────────────────────────────────────────
app.get("/api/debug/llm", async (c) => {
  const info = getLlmDebugInfo();
  return c.json(info);
});

// ── Startup ─────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? "3000");
const isProduction = process.env.RAILWAY_ENVIRONMENT !== undefined;

// Load agents on startup
loadFromSupabase().then((agents) => {
  logger.info(`Loaded ${agents.length} agents from Supabase`);
});

// Start scheduler in production
if (isProduction) {
  startScheduler();
  logger.info("Scheduler started");
}

console.log(`🚀 Server starting on port ${PORT}`);
serve({
  fetch: app.fetch,
  port: PORT,
});
