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

const CORS_ALLOWED_ORIGINS = (() => {
  const defaults = [
    "https://oishiapp.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:8080",
  ];
  const extra =
    process.env.OISHI_CORS_ORIGINS?.split(",")
      .map((s) => s.trim().replace(/\/+$/, ""))
      .filter(Boolean) ?? [];
  return [...defaults, ...extra];
})();

// ── CORS — echo Origin only when allowlisted (omit header otherwise; required when credentials: true)
app.use(
  "*",
  cors({
    origin: (origin) =>
      !origin ? null : CORS_ALLOWED_ORIGINS.includes(origin) ? origin : null,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-oishi-wallet",
      "x-oishi-signature",
      "x-oishi-message",
    ],
    exposeHeaders: [],
    maxAge: 86400,
  }),
);

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

// Load agents on startup (populate memory; detailed log is in agent-store)
loadFromSupabase().then((loaded) => {
  logger.info(`Agent store ready with ${loaded.length} agent(s)`);
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

export default app;
