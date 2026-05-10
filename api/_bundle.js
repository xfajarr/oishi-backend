var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/lib/logger.ts
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join as join2 } from "node:path";
function createLogger(component) {
  function log10(level, message, data) {
    if (LEVEL_VALUES[level] < LEVEL_VALUES[CONFIG.level]) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
    const color = LEVEL_COLORS[level];
    const label = LEVEL_LABELS[level];
    const tag = `${C.gray}${component.padEnd(14)}${C.reset}`;
    const line = `${C.dim}${timestamp}${C.reset} ${color}${label}${C.reset} ${tag} ${message}`;
    const dataStr = data ? ` ${C.dim}${JSON.stringify(data)}${C.reset}` : "";
    console.log(`${line}${dataStr}`);
    if (CONFIG.file) {
      const plain = `${timestamp} ${label.trim()} [${component}] ${message}`;
      const plainData = data ? ` ${JSON.stringify(data)}` : "";
      appendFileSync(CONFIG.file, `${plain}${plainData}
`);
    }
  }
  return {
    trace: (msg, data) => log10("trace", msg, data),
    debug: (msg, data) => log10("debug", msg, data),
    info: (msg, data) => log10("info", msg, data),
    warn: (msg, data) => log10("warn", msg, data),
    error: (msg, data) => log10("error", msg, data),
    fatal: (msg, data) => log10("fatal", msg, data)
  };
}
var LEVEL_VALUES, CONFIG, C, LEVEL_COLORS, LEVEL_LABELS;
var init_logger = __esm({
  "src/lib/logger.ts"() {
    "use strict";
    LEVEL_VALUES = {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4,
      fatal: 5
    };
    CONFIG = {
      level: process.env.LOG_LEVEL ?? "info",
      file: process.env.LOG_FILE ? join2(import.meta.dirname, "..", "..", process.env.LOG_FILE) : null,
      colors: process.env.NO_COLOR !== "1" && process.env.NODE_ENV !== "production"
    };
    if (CONFIG.file) {
      const dir = join2(import.meta.dirname, "..", "..", "logs");
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(CONFIG.file, `\u2500\u2500\u2500\u2500 Oishi Backend started at ${(/* @__PURE__ */ new Date()).toISOString()} \u2500\u2500\u2500\u2500
`);
    }
    C = CONFIG.colors ? {
      reset: "\x1B[0m",
      dim: "\x1B[2m",
      gray: "\x1B[90m",
      cyan: "\x1B[36m",
      green: "\x1B[32m",
      yellow: "\x1B[33m",
      red: "\x1B[31m",
      bold: "\x1B[1m",
      magenta: "\x1B[35m"
    } : { reset: "", dim: "", gray: "", cyan: "", green: "", yellow: "", red: "", bold: "", magenta: "" };
    LEVEL_COLORS = {
      trace: C.dim,
      debug: C.cyan,
      info: C.green,
      warn: C.yellow,
      error: C.red,
      fatal: `${C.red}${C.bold}`
    };
    LEVEL_LABELS = {
      trace: "TRACE",
      debug: "DEBUG",
      info: " INFO",
      warn: " WARN",
      error: "ERROR",
      fatal: "FATAL"
    };
  }
});

// src/services/jwt.ts
var jwt_exports = {};
__export(jwt_exports, {
  extractBearerToken: () => extractBearerToken,
  signToken: () => signToken,
  verifyToken: () => verifyToken
});
import { SignJWT, jwtVerify } from "jose";
async function signToken(wallet) {
  const token = await new SignJWT({ wallet }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(TOKEN_EXPIRY).sign(SECRET);
  log3.debug(`Token issued for ${wallet.slice(0, 8)}...`, { expiry: TOKEN_EXPIRY });
  return token;
}
async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.wallet || typeof payload.wallet !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
function extractBearerToken(header) {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
var log3, SECRET, TOKEN_EXPIRY;
var init_jwt = __esm({
  "src/services/jwt.ts"() {
    "use strict";
    init_logger();
    log3 = createLogger("jwt");
    SECRET = new TextEncoder().encode(
      process.env.JWT_SECRET ?? "oishi-dev-secret-change-in-production-min-32-chars"
    );
    TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? "7d";
  }
});

// src/lib/env.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
var ENV_PATH = join(process.cwd(), ".env");
try {
  const raw = readFileSync(ENV_PATH, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key2 = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    if (!process.env[key2]) {
      process.env[key2] = value;
    }
  }
} catch {
}

// src/main.ts
import { serve } from "@hono/node-server";
import { Hono as Hono7 } from "hono";
import { cors } from "hono/cors";

// src/routes/agents.ts
import { Hono } from "hono";

// src/services/agent-store.ts
import { v4 as uuid } from "uuid";
import { readFileSync as readFileSync2, writeFileSync as writeFileSync2, existsSync as existsSync2, mkdirSync as mkdirSync2 } from "node:fs";
import { join as join3 } from "node:path";

// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
var url = process.env.SUPABASE_URL;
var key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.warn("[supabase] SUPABASE_URL or SUPABASE_SERVICE_KEY not set \u2014 using JSON file fallback");
}
var supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
function isSupabaseReady() {
  return supabase !== null;
}

// src/services/agent-store.ts
init_logger();

// src/models/agent.ts
import { z } from "zod";
var STRATEGY_IDS = [
  "polymarket",
  "meteora",
  "kamino",
  "sanctum",
  "drift",
  "jupiter",
  "raydium",
  "marginfi"
];
var STRATEGY_CONFIG = {
  polymarket: { protocol: "Polymarket", name: "Prediction mark", risk: "high", category: "Trading", abbrev: "PM" },
  meteora: { protocol: "Meteora", name: "Dynamic LP", risk: "medium", category: "Liquidity", abbrev: "ME" },
  kamino: { protocol: "Kamino", name: "Lend & earn", risk: "low", category: "Yield", abbrev: "KM" },
  sanctum: { protocol: "Sanctum", name: "Liquid stake", risk: "low", category: "Staking", abbrev: "SC" },
  drift: { protocol: "Drift", name: "Perps & spots", risk: "high", category: "Trading", abbrev: "DR" },
  jupiter: { protocol: "Jupiter", name: "Swap & DCA", risk: "medium", category: "Trading", abbrev: "JP" },
  raydium: { protocol: "Raydium", name: "AMM LP", risk: "medium", category: "Liquidity", abbrev: "RD" },
  marginfi: { protocol: "marginfi", name: "Lend & borrow", risk: "high", category: "Yield", abbrev: "MF" }
};
var CommonRulesSchema = z.object({
  dailyCapUsd: z.number().min(5).max(1e4).default(75),
  maxPerTxUsd: z.number().min(1).max(5e3).default(35),
  notifyOnBlock: z.boolean().default(true),
  quietHoursEnabled: z.boolean().default(false)
});
var defaultCommonRules = {
  dailyCapUsd: 75,
  maxPerTxUsd: 35,
  notifyOnBlock: true,
  quietHoursEnabled: false
};
var DEFAULT_SPECIFIC = {
  polymarket: { maxPosition: 50, liquidOnly: true },
  meteora: { ilTolerance: 40, autoRebal: true },
  kamino: { apyLean: 45, stableOnly: true },
  sanctum: { maxLstPct: 60, jitoPrefer: false },
  drift: { maxLev: 3, isolated: true },
  jupiter: { slippageBps: 50, auditedRoutes: true },
  raydium: { maxPoolPct: 35, concentrated: false },
  marginfi: { maxLtv: 55, borrowOff: false }
};
var CreateAgentSchema = z.object({
  displayName: z.string().min(1).max(48),
  handle: z.string().min(3).max(30).regex(/^@[a-z0-9][a-z0-9-]*[a-z0-9]\.oishi$/, "Invalid handle format"),
  strategyId: z.enum(STRATEGY_IDS),
  commonRules: CommonRulesSchema.optional().default(defaultCommonRules),
  specificRules: z.record(z.string(), z.union([z.number(), z.boolean()])).optional().default({})
});
var UpdateRulesSchema = z.object({
  commonRules: CommonRulesSchema.optional(),
  specificRules: z.record(z.string(), z.union([z.number(), z.boolean()])).optional()
});

// src/services/agent-store.ts
var log = createLogger("agent-store");
var DATA_DIR = join3(import.meta.dirname, "..", "data");
var AGENTS_FILE = join3(DATA_DIR, "agents.json");
var agents = /* @__PURE__ */ new Map();
function ensureDataDir() {
  if (!existsSync2(DATA_DIR)) mkdirSync2(DATA_DIR, { recursive: true });
}
function saveToFile() {
  ensureDataDir();
  writeFileSync2(AGENTS_FILE, JSON.stringify([...agents.values()], null, 2));
}
function loadFromFile() {
  try {
    if (!existsSync2(AGENTS_FILE)) return;
    for (const a of JSON.parse(readFileSync2(AGENTS_FILE, "utf-8"))) agents.set(a.id, a);
    log.info(`Loaded ${agents.size} agents from disk`);
  } catch (err) {
    log.warn("Could not load agents", { error: String(err) });
  }
}
if (!isSupabaseReady()) {
  loadFromFile();
  log.info("Using JSON file storage");
} else {
  log.info("Using Supabase storage");
}
function rowToAgent(row) {
  return {
    id: row.id,
    owner: row.owner,
    handle: row.handle,
    displayName: row.display_name,
    strategyId: row.strategy_id,
    commonRules: row.common_rules ?? defaultCommonRules,
    specificRules: row.specific_rules ?? {},
    status: row.status,
    kyaIdentityPda: row.kya_identity_pda,
    kyaReputationScore: row.kya_reputation,
    attestationCount: row.attestations,
    totalEarnings: row.total_earnings,
    totalTxCount: row.total_tx_count,
    cycleCount: row.cycle_count,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).getTime() : null
  };
}
function agentToRow(a) {
  return {
    owner: a.owner,
    handle: a.handle,
    display_name: a.displayName,
    strategy_id: a.strategyId,
    common_rules: a.commonRules,
    specific_rules: a.specificRules,
    status: a.status,
    kya_identity_pda: a.kyaIdentityPda,
    kya_reputation: a.kyaReputationScore,
    attestations: a.attestationCount,
    total_earnings: a.totalEarnings,
    total_tx_count: a.totalTxCount,
    cycle_count: a.cycleCount,
    last_active_at: a.lastActiveAt ? new Date(a.lastActiveAt).toISOString() : null
  };
}
function createAgent(owner, input, kyaIdentityPda = null) {
  const id = uuid();
  const now = Date.now();
  const specificDefaults = DEFAULT_SPECIFIC[input.strategyId] ?? {};
  const agent = {
    id,
    owner,
    handle: input.handle,
    displayName: input.displayName,
    strategyId: input.strategyId,
    commonRules: { ...defaultCommonRules, ...input.commonRules },
    specificRules: { ...specificDefaults, ...input.specificRules },
    status: "active",
    kyaIdentityPda,
    kyaReputationScore: 0,
    attestationCount: 0,
    totalEarnings: 0,
    totalTxCount: 0,
    cycleCount: 0,
    createdAt: now,
    updatedAt: now,
    lastActiveAt: null
  };
  if (isSupabaseReady() && supabase) {
    supabase.from("agents").insert({ id, ...agentToRow(agent), created_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() }).then(() => {
    });
  }
  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}
function getAgent(id) {
  return agents.get(id);
}
function getAgentsByOwner(owner) {
  return [...agents.values()].filter((a) => a.owner === owner);
}
function getActiveAgents() {
  return [...agents.values()].filter((a) => a.status === "active");
}
function getAllAgents() {
  return [...agents.values()];
}
function updateAgentRules(id, commonRules, specificRules) {
  const agent = agents.get(id);
  if (!agent) return null;
  if (commonRules) agent.commonRules = { ...agent.commonRules, ...commonRules };
  if (specificRules) agent.specificRules = { ...agent.specificRules, ...specificRules };
  agent.updatedAt = Date.now();
  if (isSupabaseReady() && supabase) {
    supabase.from("agents").update({ common_rules: agent.commonRules, specific_rules: agent.specificRules, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).then(() => {
    });
  }
  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}
function updateAgentStatus(id, status) {
  const agent = agents.get(id);
  if (!agent) return null;
  agent.status = status;
  agent.updatedAt = Date.now();
  if (status === "active") agent.lastActiveAt = Date.now();
  if (isSupabaseReady() && supabase) {
    supabase.from("agents").update({ status, last_active_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).then(() => {
    });
  }
  agents.set(id, agent);
  if (!isSupabaseReady()) saveToFile();
  return agent;
}
function updateAgentState(id, updates) {
  const agent = agents.get(id);
  if (!agent) return null;
  Object.assign(agent, updates);
  agent.updatedAt = Date.now();
  agents.set(id, agent);
  return agent;
}
async function loadFromSupabase() {
  if (!isSupabaseReady() || !supabase) return;
  const { data, error } = await supabase.from("agents").select("*");
  if (error) {
    log.error("Failed to load agents from Supabase", { error: error.message });
    return;
  }
  for (const row of data) {
    agents.set(row.id, rowToAgent(row));
  }
  log.info(`Loaded ${agents.size} agents from Supabase`);
}
function persistAll() {
  if (!isSupabaseReady()) saveToFile();
}

// src/services/context-store.ts
import { readFileSync as readFileSync3, writeFileSync as writeFileSync3, existsSync as existsSync3, mkdirSync as mkdirSync3 } from "node:fs";
import { join as join4 } from "node:path";
init_logger();

// src/models/context.ts
function createDefaultContext(agentId, systemPrompt) {
  return {
    agentId,
    sessionId: agentId,
    // one session per agent for now
    systemPrompt,
    messages: [
      {
        role: "system",
        content: systemPrompt,
        timestamp: Date.now()
      }
    ],
    decisions: [],
    state: {
      solBalance: 0,
      usdcBalance: 0,
      solUsd: 0,
      usdcUsd: 0,
      positions: {},
      dailySpent: 0,
      dailyResetAt: nextDailyReset(),
      lastCycleAt: null
    },
    memory: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}
function nextDailyReset() {
  const now = /* @__PURE__ */ new Date();
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.getTime();
}

// src/services/context-store.ts
var log2 = createLogger("context-store");
var DATA_DIR2 = join4(import.meta.dirname, "..", "data");
var CONTEXTS_FILE = join4(DATA_DIR2, "contexts.json");
var contexts = /* @__PURE__ */ new Map();
function ensureDataDir2() {
  if (!existsSync3(DATA_DIR2)) mkdirSync3(DATA_DIR2, { recursive: true });
}
function saveToFile2() {
  ensureDataDir2();
  writeFileSync3(CONTEXTS_FILE, JSON.stringify([...contexts.values()], null, 2));
}
function loadFromFile2() {
  try {
    if (!existsSync3(CONTEXTS_FILE)) return;
    for (const ctx of JSON.parse(readFileSync3(CONTEXTS_FILE, "utf-8"))) contexts.set(ctx.agentId, ctx);
    log2.info(`Loaded ${contexts.size} agent contexts from disk`);
  } catch (err) {
    log2.warn("Could not load contexts", { error: String(err) });
  }
}
if (!isSupabaseReady()) {
  loadFromFile2();
}
function initContext(agentId, systemPrompt) {
  const ctx = createDefaultContext(agentId, systemPrompt);
  contexts.set(agentId, ctx);
  if (isSupabaseReady() && supabase) {
    supabase.from("agent_contexts").upsert({
      agent_id: agentId,
      session_id: ctx.sessionId,
      system_prompt: systemPrompt,
      messages: JSON.stringify(ctx.messages),
      decisions: JSON.stringify([]),
      state: JSON.stringify(ctx.state),
      memory: JSON.stringify({}),
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).then(() => {
    });
  }
  if (!isSupabaseReady()) saveToFile2();
  return ctx;
}
function getContext(agentId) {
  return contexts.get(agentId);
}
function addMessages(agentId, messages) {
  const ctx = contexts.get(agentId);
  if (!ctx) return null;
  ctx.messages.push(...messages);
  ctx.updatedAt = Date.now();
  contexts.set(agentId, ctx);
  return ctx;
}
function persistAll2() {
  if (!isSupabaseReady()) saveToFile2();
}

// src/llm/prompts.ts
function buildSystemPrompt(strategyId, commonRules, specificRules, state) {
  const strategyContext = STRATEGY_CONTEXT[strategyId] ?? "Execute your strategy.";
  const rulesContext = buildRulesContext(commonRules, specificRules, state);
  return `You are an autonomous AI agent running on Oishi \u2014 a Solana-based agent platform.

${strategyContext}

## Your Identity
- You are an on-chain agent with a programmatic wallet
- Every action you take is logged and builds your KYA (Know Your Agent) reputation
- You operate 24/7 within the guardrails your owner has set

${rulesContext}

## How to Act
- Think step by step about market conditions and your strategy
- Call tools to take actions (trade, deposit, compound, rebalance)
- Call "wait" if conditions aren't right \u2014 doing nothing is better than bad trades
- Be conservative. Protect your owner's funds. The rules are hard limits, not suggestions.
- After every action, explain your reasoning briefly

## Current State
- SOL balance: ${state.solBalance.toFixed(4)} SOL (\u2248$${(state.solBalance * 130).toFixed(2)})
- USDC balance: ${state.usdcBalance.toFixed(2)} USDC
- Spent today: $${state.dailySpent.toFixed(2)}
- Remaining daily budget: $${(commonRules.dailyCapUsd - state.dailySpent).toFixed(2)}

What should you do this cycle?`;
}
function buildRulesContext(common, specific, state) {
  const lines = [];
  lines.push("## Your Rules (HARD LIMITS \u2014 do not exceed)");
  lines.push(`- Daily spending cap: $${common.dailyCapUsd}`);
  lines.push(`- Max per transaction: $${common.maxPerTxUsd}`);
  lines.push(`- Remaining today: $${(common.dailyCapUsd - state.dailySpent).toFixed(2)}`);
  if (common.quietHoursEnabled) lines.push("- Quiet hours: no trades 23:00-07:00 UTC");
  const specEntries = Object.entries(specific);
  if (specEntries.length > 0) {
    lines.push("\n### Strategy-specific limits:");
    for (const [key2, value] of specEntries) {
      lines.push(`- ${key2}: ${value}`);
    }
  }
  return lines.join("\n");
}
var STRATEGY_CONTEXT = {
  kamino: `## Your Strategy: Kamino Yield Farmer
You are a Kamino yield optimization agent. Your job:
1. Check available Kamino yield vaults for the best APY
2. Deposit idle USDC into the highest-yielding vault that meets your APY threshold
3. Compound rewards when profitable
4. Stay in stablecoin vaults unless your rules allow otherwise
5. Monitor APY changes and consider moving funds if better rates appear`,
  drift: `## Your Strategy: Drift Perp Trader
You are a Drift perpetual futures trading agent. Your job:
1. Monitor market conditions for trading opportunities
2. Open positions within your leverage and size limits
3. Close positions when targets are hit or stop-loss triggers
4. Never exceed your max leverage \u2014 it's a hard limit, not a suggestion
5. Size positions conservatively relative to portfolio`,
  polymarket: `## Your Strategy: Polymarket Prediction Trader
You are a Polymarket prediction market agent. Your job:
1. Search for active prediction markets with good liquidity
2. Place measured bets within your position limits
3. Diversify across markets \u2014 don't bet everything on one outcome
4. Only bet on liquid markets (>$2M depth if rule is enabled)
5. Track your P&L and don't chase losses`,
  jupiter: `## Your Strategy: Jupiter DCA & Swaps
You are a Jupiter DCA/swap agent. Your job:
1. Check if it's time for a scheduled DCA buy
2. Get the best swap route via Jupiter aggregator
3. Execute within slippage and size limits
4. Use audited routes when the rule is enabled
5. Accumulate steadily \u2014 this is a long game`,
  meteora: `## Your Strategy: Meteora DLMM LP Manager
You are a Meteora DLMM liquidity provider. Your job:
1. Monitor your LP pools for price movements
2. Rebalance to the optimal range when price exits your band
3. Compound earned fees
4. Stay within your impermanent loss tolerance
5. Auto-rebalance if enabled in your rules`,
  sanctum: `## Your Strategy: Sanctum Liquid Staker
You are a Sanctum liquid staking agent. Your job:
1. Monitor LST rates and pick the best-yielding token
2. Stake idle SOL when rates are attractive
3. Keep SOL/LST ratio within your configured limits
4. Prefer Jito-backed routes if that rule is enabled
5. Compound staking rewards`,
  raydium: `## Your Strategy: Raydium AMM LP Provider
You are a Raydium liquidity provider. Your job:
1. Check pool yields and TVL
2. Provide concentrated or wide-range liquidity based on rules
3. Rebalance when needed
4. Stay within max pool share limits
5. Monitor for better pools to move to`,
  marginfi: `## Your Strategy: marginfi Lending Agent
You are a marginfi lending and borrowing agent. Your job:
1. Monitor lending rates for supply opportunities
2. Supply collateral for attractive yields
3. Only borrow if your rules allow it and within LTV limits
4. Never exceed max LTV \u2014 liquidation risk is real
5. Keep reserves for withdrawals`
};

// src/routes/agents.ts
init_logger();

// src/services/auth.ts
init_jwt();
init_logger();
import nacl from "tweetnacl";
import bs58 from "bs58";
var log4 = createLogger("auth");
var DEV_MODE = process.env.OISHI_DEV_MODE === "1";
function verifyWalletSignature(payload) {
  if (DEV_MODE) return true;
  try {
    const publicKeyBytes = bs58.decode(payload.wallet);
    const signatureBytes = bs58.decode(payload.signature);
    const messageBytes = new TextEncoder().encode(payload.message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}
function extractAuth(headers) {
  const wallet = headers.get("x-oishi-wallet");
  const signature = headers.get("x-oishi-signature");
  const message = headers.get("x-oishi-message");
  if (DEV_MODE && wallet) {
    return { wallet, signature: "dev", message: JSON.stringify({ timestamp: Date.now() }) };
  }
  if (!wallet || !signature || !message) return null;
  return { wallet, signature, message };
}
function requireAuth() {
  return async function authMiddleware(c, next) {
    const authHeader = c.req.header("Authorization");
    const token = extractBearerToken(authHeader);
    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        c.set("wallet", payload.wallet);
        await next();
        return;
      }
    }
    const headers = {
      get: (name) => c.req.header(name)
    };
    const auth = extractAuth(headers);
    if (!auth) {
      if (token) {
        return c.json({ error: "Session expired. Please sign in again." }, 401);
      }
      return c.json(
        { error: "Authentication required. Provide Bearer token or wallet signature headers." },
        401
      );
    }
    if (!verifyWalletSignature(auth)) {
      return c.json({ error: "Invalid wallet signature" }, 401);
    }
    if (!DEV_MODE) {
      try {
        const parsed = JSON.parse(auth.message);
        const age = Date.now() - parsed.timestamp;
        if (age > 5 * 60 * 1e3) {
          return c.json({ error: "Signature expired (>5 min old)" }, 401);
        }
      } catch {
        return c.json({ error: "Invalid auth message format" }, 401);
      }
    }
    c.set("wallet", auth.wallet);
    await next();
  };
}

// src/routes/agents.ts
var log5 = createLogger("agents");
var agentsRouter = new Hono();
agentsRouter.get("/_strategies", (c) => {
  const strategies = STRATEGY_IDS.map((id) => ({
    id,
    ...STRATEGY_CONFIG[id]
  }));
  return c.json({ strategies });
});
agentsRouter.post("/", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const body = await c.req.json();
  const parsed = CreateAgentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }
  const allAgents = getAllAgents();
  if (allAgents.some((a) => a.handle === parsed.data.handle)) {
    return c.json({ error: "Handle already taken" }, 409);
  }
  const agent = createAgent(wallet, parsed.data);
  const prompt = buildSystemPrompt(
    agent.strategyId,
    agent.commonRules,
    agent.specificRules,
    { solBalance: 0, usdcBalance: 0, dailySpent: 0 }
  );
  initContext(agent.id, prompt);
  log5.info(`Agent created: ${agent.handle}`, { strategy: agent.strategyId, wallet: wallet.slice(0, 6) + "..." });
  return c.json({ agent }, 201);
});
agentsRouter.get("/", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const agents2 = getAgentsByOwner(wallet);
  return c.json({ agents: agents2, count: agents2.length });
});
agentsRouter.get("/:id", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  return c.json({ agent });
});
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
agentsRouter.post("/:id/pause", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  const updated = updateAgentStatus(id, "paused");
  return c.json({ agent: updated });
});
agentsRouter.post("/:id/resume", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  const updated = updateAgentStatus(id, "active");
  return c.json({ agent: updated });
});
agentsRouter.delete("/:id", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  updateAgentStatus(id, "stopped");
  return c.json({ success: true });
});

// src/routes/agent-run.ts
import { Hono as Hono2 } from "hono";
import { z as z2 } from "zod";

// src/models/skill.ts
function getSkillsForStrategy(strategyId) {
  const base = BASE_SKILLS;
  const specific = STRATEGY_SKILLS[strategyId] ?? [];
  return [...base, ...specific];
}
var BASE_SKILLS = [
  {
    id: "check_balance",
    name: "Check Balance",
    description: "Get the current SOL and USDC balance of the agent wallet",
    toolDefinition: {
      type: "function",
      function: {
        "strict": true,
        name: "check_balance",
        description: "Get the current SOL and USDC balance of the agent wallet",
        parameters: { type: "object", properties: {}, required: [] }
      }
    },
    enabled: true
  },
  {
    id: "wait",
    name: "Wait / Do Nothing",
    description: "Choose to take no action this cycle",
    toolDefinition: {
      type: "function",
      function: {
        "strict": true,
        name: "wait",
        description: "Take no action this cycle. Use when market conditions aren't favorable or you're waiting.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Why you chose to wait" }
          },
          required: ["reason"]
        }
      }
    },
    enabled: true
  }
];
var STRATEGY_SKILLS = {
  kamino: [
    {
      id: "check_yield_vaults",
      name: "Check Yield Vaults",
      description: "Query Kamino yield vaults for current APY rates",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "check_yield_vaults",
          description: "Query available Kamino yield vaults and their current APY rates",
          parameters: {
            type: "object",
            properties: {
              stableOnly: { type: "boolean", description: "If true, only return stablecoin vaults" }
            }
          }
        }
      },
      enabled: true
    },
    {
      id: "deposit_to_kamino",
      name: "Deposit to Kamino",
      description: "Deposit funds into a Kamino yield vault",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "deposit_to_kamino",
          description: "Deposit a specified amount of USDC into a Kamino yield vault",
          parameters: {
            type: "object",
            properties: {
              vault: { type: "string", description: "Vault identifier or name" },
              amount: { type: "number", description: "Amount in USDC to deposit" }
            },
            required: ["vault", "amount"]
          }
        }
      },
      enabled: true
    },
    {
      id: "compound_rewards",
      name: "Compound Rewards",
      description: "Harvest and compound yield rewards",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "compound_rewards",
          description: "Harvest pending rewards and re-deposit (compound) them",
          parameters: {
            type: "object",
            properties: {
              vault: { type: "string", description: "The vault to compound in" }
            },
            required: ["vault"]
          }
        }
      },
      enabled: true
    }
  ],
  drift: [
    {
      id: "check_positions",
      name: "Check Positions",
      description: "List current open perp positions on Drift",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "check_positions",
          description: "List current open perpetual positions on Drift protocol",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      enabled: true
    },
    {
      id: "open_perp_trade",
      name: "Open Perp Trade",
      description: "Open a new perpetual futures position on Drift",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "open_perp_trade",
          description: "Open a new perpetual futures position on Drift",
          parameters: {
            type: "object",
            properties: {
              market: { type: "string", description: "Market symbol (e.g. SOL-PERP)" },
              direction: { type: "string", enum: ["long", "short"] },
              size: { type: "number", description: "Position size in USD" },
              leverage: { type: "number", description: "Leverage multiplier (1-10)" }
            },
            required: ["market", "direction", "size", "leverage"]
          }
        }
      },
      enabled: true
    },
    {
      id: "close_position",
      name: "Close Position",
      description: "Close an open perp position",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "close_position",
          description: "Close an open perpetual position on Drift",
          parameters: {
            type: "object",
            properties: {
              market: { type: "string", description: "Market symbol to close" }
            },
            required: ["market"]
          }
        }
      },
      enabled: true
    }
  ],
  polymarket: [
    {
      id: "search_markets",
      name: "Search Markets",
      description: "Search Polymarket prediction markets",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "search_markets",
          description: "Search for active prediction markets on Polymarket",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              category: { type: "string", description: "Category filter (politics, crypto, sports, etc.)" }
            }
          }
        }
      },
      enabled: true
    },
    {
      id: "place_bet",
      name: "Place Bet",
      description: "Place a bet on a Polymarket prediction market",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "place_bet",
          description: "Place a bet on a Polymarket prediction market",
          parameters: {
            type: "object",
            properties: {
              marketId: { type: "string", description: "Market ID" },
              outcome: { type: "string", description: "Which outcome to bet on (Yes/No or specific)" },
              amount: { type: "number", description: "Bet amount in USDC" }
            },
            required: ["marketId", "outcome", "amount"]
          }
        }
      },
      enabled: true
    }
  ],
  jupiter: [
    {
      id: "get_swap_quote",
      name: "Get Swap Quote",
      description: "Get a Jupiter swap quote for a token pair",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "get_swap_quote",
          description: "Get the best swap route and price quote from Jupiter aggregator",
          parameters: {
            type: "object",
            properties: {
              inputToken: { type: "string", description: "Input token mint or symbol" },
              outputToken: { type: "string", description: "Output token mint or symbol" },
              amount: { type: "number", description: "Amount of input token to swap" }
            },
            required: ["inputToken", "outputToken", "amount"]
          }
        }
      },
      enabled: true
    },
    {
      id: "execute_dca_buy",
      name: "Execute DCA Buy",
      description: "Execute a scheduled dollar-cost-average buy",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "execute_dca_buy",
          description: "Execute a scheduled DCA (dollar-cost average) buy order on Jupiter",
          parameters: {
            type: "object",
            properties: {
              token: { type: "string", description: "Token to buy (e.g. SOL)" },
              amount: { type: "number", description: "USD amount to spend on this DCA buy" }
            },
            required: ["token", "amount"]
          }
        }
      },
      enabled: true
    }
  ],
  meteora: [
    {
      id: "check_pools",
      name: "Check Pools",
      description: "Check Meteora DLMM pool status and ranges",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "check_pools",
          description: "Check Meteora DLMM pool status, current price, and optimal ranges",
          parameters: {
            type: "object",
            properties: {
              tokenPair: { type: "string", description: "Token pair to check (e.g. SOL-USDC)" }
            }
          }
        }
      },
      enabled: true
    },
    {
      id: "rebalance_lp",
      name: "Rebalance LP",
      description: "Rebalance LP position to optimal range",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "rebalance_lp",
          description: "Rebalance a Meteora DLMM liquidity position to the current optimal price range",
          parameters: {
            type: "object",
            properties: {
              pool: { type: "string", description: "Pool identifier" }
            },
            required: ["pool"]
          }
        }
      },
      enabled: true
    }
  ],
  sanctum: [
    {
      id: "check_lst_rates",
      name: "Check LST Rates",
      description: "Check liquid staking token rates on Sanctum",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "check_lst_rates",
          description: "Check current liquid staking token APY rates on Sanctum",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      enabled: true
    },
    {
      id: "stake_sol",
      name: "Stake SOL",
      description: "Stake SOL into a liquid staking token",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "stake_sol",
          description: "Stake SOL into a liquid staking token on Sanctum",
          parameters: {
            type: "object",
            properties: {
              lstSymbol: { type: "string", description: "LST symbol (e.g. bonkSOL, jitoSOL)" },
              amount: { type: "number", description: "Amount of SOL to stake" }
            },
            required: ["lstSymbol", "amount"]
          }
        }
      },
      enabled: true
    }
  ],
  raydium: [
    {
      id: "check_raydium_pools",
      name: "Check Raydium Pools",
      description: "Check Raydium AMM pool status and yields",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "check_raydium_pools",
          description: "Check Raydium AMM/CLMM pool status, TVL, and current yields",
          parameters: {
            type: "object",
            properties: {
              tokenPair: { type: "string", description: "Token pair filter (optional)" }
            }
          }
        }
      },
      enabled: true
    },
    {
      id: "provide_liquidity",
      name: "Provide Liquidity",
      description: "Provide liquidity to a Raydium pool",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "provide_liquidity",
          description: "Provide liquidity to a Raydium pool",
          parameters: {
            type: "object",
            properties: {
              pool: { type: "string", description: "Pool address or identifier" },
              amount: { type: "number", description: "Amount in USD to provide" },
              concentrated: { type: "boolean", description: "Use concentrated liquidity range?" }
            },
            required: ["pool", "amount"]
          }
        }
      },
      enabled: true
    }
  ],
  marginfi: [
    {
      id: "check_lending",
      name: "Check Lending Markets",
      description: "Check marginfi lending/borrowing rates",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "check_lending",
          description: "Check marginfi lending and borrowing rates",
          parameters: { type: "object", properties: {}, required: [] }
        }
      },
      enabled: true
    },
    {
      id: "supply_collateral",
      name: "Supply Collateral",
      description: "Supply collateral to marginfi for lending",
      toolDefinition: {
        type: "function",
        function: {
          "strict": true,
          name: "supply_collateral",
          description: "Supply collateral to marginfi",
          parameters: {
            type: "object",
            properties: {
              token: { type: "string", description: "Token to supply as collateral" },
              amount: { type: "number", description: "Amount to supply" }
            },
            required: ["token", "amount"]
          }
        }
      },
      enabled: true
    }
  ]
};

// src/services/scheduler.ts
init_logger();

// src/llm/agent-loop.ts
import { v4 as uuid2 } from "uuid";

// src/llm/client.ts
import { OpenAI, APIError } from "openai";
function normalizeLlmBaseUrl(raw) {
  const u = raw.trim().replace(/\/+$/, "");
  if (!u) return "https://api.openai.com/v1";
  if (/\/v1$/i.test(u) || /\/v1\//i.test(u)) return u;
  return `${u}/v1`;
}
var LLM_BASE_URL = normalizeLlmBaseUrl(process.env.LLM_BASE_URL ?? "https://api.openai.com/v1");
var LLM_API_KEY = process.env.LLM_API_KEY ?? "sk-missing";
var LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o";
var LLM_DISABLE_TOOLS = process.env.LLM_DISABLE_TOOLS === "1";
var client = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY
});
function formatLlmFailure(err) {
  if (err instanceof APIError) {
    let bodyMessage = "";
    try {
      const raw = err.response?.body ?? err.message;
      if (typeof raw === "string" && raw.length > 0 && raw.length < 2e3) {
        const parsed = JSON.parse(raw);
        bodyMessage = parsed.message ?? parsed.error ?? parsed.detail ?? "";
      }
    } catch {
    }
    const parts = [`HTTP ${err.status}`];
    if (bodyMessage) {
      parts.push(bodyMessage);
    } else if (err.message && err.message !== "400 status code (no body)") {
      parts.push(err.message);
    }
    if (err.status === 400 && !bodyMessage) {
      parts.push("Check your LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL. The provider rejected the request.");
    }
    if (err.status === 401 || err.status === 403) {
      parts.push("API key invalid or lacks permissions.");
    }
    if (err.status === 429 || bodyMessage && /rate limit|quota|credit/i.test(bodyMessage)) {
      parts.push("Rate limit hit or account out of credits. Top up your LLM provider account.");
    }
    return parts.join(" \xB7 ");
  }
  return String(err);
}
function getLlmDebugInfo() {
  return `${LLM_MODEL} @ ${LLM_BASE_URL}`;
}
function agentMessageToOpenAI(m) {
  if (m.role === "tool") {
    return {
      role: "tool",
      tool_call_id: m.toolCallId ?? "",
      content: m.content ?? ""
    };
  }
  if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments ?? {})
        }
      }))
    };
  }
  if (m.role === "user") {
    return { role: "user", content: m.content ?? "" };
  }
  return { role: "assistant", content: m.content ?? "" };
}
async function callLlm(params) {
  const openaiTools = LLM_DISABLE_TOOLS ? [] : params.tools.map((t) => t.toolDefinition);
  const chatMessages = [
    { role: "system", content: params.systemPrompt },
    ...params.messages.map(agentMessageToOpenAI),
    { role: "user", content: params.userMessage }
  ];
  let response;
  try {
    response = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: chatMessages,
      tools: openaiTools.length > 0 ? openaiTools : void 0,
      tool_choice: openaiTools.length > 0 ? "auto" : void 0,
      temperature: 0.4,
      max_tokens: 1e3,
      parallel_tool_calls: false
    });
  } catch (err) {
    throw new Error(formatLlmFailure(err));
  }
  const choice = response.choices[0]?.message;
  return {
    content: choice?.content ?? null,
    toolCalls: (choice?.tool_calls ?? []).flatMap((tc) => {
      if (tc.type !== "function") return [];
      return [
        {
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }
      ];
    })
  };
}
function getLlmModel() {
  return LLM_MODEL;
}
function executeToolCall(name, args, agentState) {
  switch (name) {
    case "check_balance":
      return {
        success: true,
        result: JSON.stringify({
          sol: agentState.solBalance,
          usdc: agentState.usdcBalance,
          solUsd: agentState.solBalance * 130,
          usdcUsd: agentState.usdcBalance
        })
      };
    case "wait":
      return { success: true, result: `Waiting: ${args.reason ?? "no action needed"}` };
    case "deposit_to_kamino":
      return {
        success: true,
        result: `[SIMULATED] Deposited ${args.amount} USDC into Kamino vault "${args.vault}". APY: ~8.2%.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) }
      };
    case "compound_rewards":
      return {
        success: true,
        result: `[SIMULATED] Compounded rewards in vault "${args.vault}". +$1.20 USDC.`,
        stateChange: { usdcBalance: agentState.usdcBalance + 1.2 }
      };
    case "open_perp_trade":
      return {
        success: true,
        result: `[SIMULATED] Opened ${args.direction} position on ${args.market}: size $${args.size} at ${args.leverage}x leverage.`
      };
    case "close_position":
      return {
        success: true,
        result: `[SIMULATED] Closed position on ${args.market}.`
      };
    case "place_bet":
      return {
        success: true,
        result: `[SIMULATED] Placed bet: $${args.amount} on "${args.outcome}" for market ${args.marketId}.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) }
      };
    case "execute_dca_buy":
      return {
        success: true,
        result: `[SIMULATED] DCA buy: $${args.amount} of ${args.token}. Bought at best Jupiter route.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) }
      };
    case "rebalance_lp":
      return {
        success: true,
        result: `[SIMULATED] Rebalanced LP position in pool "${args.pool}" to optimal range.`
      };
    case "stake_sol":
      return {
        success: true,
        result: `[SIMULATED] Staked ${args.amount} SOL into ${args.lstSymbol}.`,
        stateChange: { solBalance: agentState.solBalance - Number(args.amount) }
      };
    case "provide_liquidity":
      return {
        success: true,
        result: `[SIMULATED] Provided $${args.amount} LP to pool "${args.pool}".`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) }
      };
    case "supply_collateral":
      return {
        success: true,
        result: `[SIMULATED] Supplied ${args.amount} ${args.token} as collateral on marginfi.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) }
      };
    default:
      return { success: true, result: `[SIMULATED] Executed ${name} with args: ${JSON.stringify(args)}.` };
  }
}

// src/llm/tools.ts
function checkPolicy(toolName, args, common, _specific, dailySpent) {
  const spendActions = ["deposit_to_kamino", "place_bet", "execute_dca_buy", "stake_sol", "provide_liquidity", "supply_collateral", "open_perp_trade"];
  const amount = Number(args.amount ?? args.size ?? 0);
  if (spendActions.includes(toolName) && amount > 0) {
    if (amount > common.maxPerTxUsd) {
      return {
        allowed: false,
        reason: `Amount $${amount} exceeds max per-transaction limit of $${common.maxPerTxUsd}`
      };
    }
    if (dailySpent + amount > common.dailyCapUsd) {
      return {
        allowed: false,
        reason: `Would spend $${(dailySpent + amount).toFixed(2)} today, exceeding daily cap of $${common.dailyCapUsd} (already spent $${dailySpent.toFixed(2)})`
      };
    }
    return { allowed: true };
  }
  if (toolName === "open_perp_trade" && args.leverage) {
    const lev = Number(args.leverage);
    if (lev > 10) {
      return { allowed: false, reason: `Leverage ${lev}x exceeds maximum 10x` };
    }
  }
  return { allowed: true };
}
function getEnabledSkills(skills) {
  return skills.filter((s) => s.enabled);
}

// src/llm/agent-loop.ts
init_logger();
var log6 = createLogger("agent-loop");
async function runAgentCycle(agentId) {
  const agent = getAgent(agentId);
  if (!agent) return { success: false, error: "Agent not found" };
  if (agent.status !== "active") return { success: false, error: `Agent is ${agent.status}` };
  let context = getContext(agentId);
  if (!context) {
    const prompt = buildSystemPrompt(
      agent.strategyId,
      agent.commonRules,
      agent.specificRules,
      { solBalance: 0, usdcBalance: 0, dailySpent: 0 }
    );
    context = initContext(agentId, prompt);
  }
  if (Date.now() >= context.state.dailyResetAt) {
    context.state.dailySpent = 0;
    context.state.dailyResetAt = nextDailyReset();
  }
  const skills = getSkillsForStrategy(agent.strategyId);
  const enabledSkills = getEnabledSkills(skills);
  const systemPrompt = buildSystemPrompt(
    agent.strategyId,
    agent.commonRules,
    agent.specificRules,
    {
      solBalance: context.state.solBalance,
      usdcBalance: context.state.usdcBalance,
      dailySpent: context.state.dailySpent
    }
  );
  if (context.messages[0]?.content !== systemPrompt) {
    context.messages[0] = { role: "system", content: systemPrompt, timestamp: Date.now() };
  }
  let llmResponse;
  try {
    llmResponse = await callLlm({
      systemPrompt,
      messages: context.messages.slice(1),
      // skip system message (already in systemPrompt param)
      tools: enabledSkills,
      userMessage: "Analyze the current state and decide what action to take this cycle. Be concise."
    });
  } catch (err) {
    log6.error(`LLM call failed for ${agent.handle}`, { error: String(err) });
    return { success: false, error: `LLM error: ${String(err)}` };
  }
  const assistantMsg = {
    role: "assistant",
    content: llmResponse.content,
    toolCalls: llmResponse.toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments
    })),
    timestamp: Date.now()
  };
  context.messages.push(assistantMsg);
  const results = [];
  for (const tc of llmResponse.toolCalls) {
    const policy = checkPolicy(
      tc.name,
      tc.arguments,
      agent.commonRules,
      agent.specificRules,
      context.state.dailySpent
    );
    let result;
    let status;
    if (!policy.allowed) {
      result = `BLOCKED: ${policy.reason}`;
      status = "blocked";
    } else {
      const execution = executeToolCall(tc.name, tc.arguments, {
        solBalance: context.state.solBalance,
        usdcBalance: context.state.usdcBalance
      });
      result = execution.result;
      status = "executed";
      if (execution.stateChange) {
        context.state.solBalance += execution.stateChange.solBalance ?? 0;
        context.state.usdcBalance += execution.stateChange.usdcBalance ?? 0;
        const spent = Math.abs(
          (execution.stateChange.usdcBalance ?? 0) + (execution.stateChange.solBalance ?? 0) * 130
        );
        context.state.dailySpent += spent;
      }
    }
    const decision = {
      id: uuid2(),
      action: tc.name,
      params: tc.arguments,
      reasoning: llmResponse.content ?? "No reasoning provided",
      status,
      blockReason: status === "blocked" ? policy.reason : void 0,
      timestamp: Date.now()
    };
    context.decisions.push(decision);
    const toolMsg = {
      role: "tool",
      content: result,
      toolCallId: tc.id,
      timestamp: Date.now()
    };
    context.messages.push(toolMsg);
    results.push({
      action: tc.name,
      reasoning: llmResponse.content ?? "",
      blocked: status === "blocked",
      blockReason: policy.reason
    });
  }
  if (llmResponse.toolCalls.length === 0 && llmResponse.content) {
    context.decisions.push({
      id: uuid2(),
      action: "observe",
      params: {},
      reasoning: llmResponse.content,
      status: "executed",
      timestamp: Date.now()
    });
    results.push({ action: "observe", reasoning: llmResponse.content });
  }
  context.state.lastCycleAt = Date.now();
  context.updatedAt = Date.now();
  updateAgentState(agentId, {
    cycleCount: (agent.cycleCount ?? 0) + 1,
    lastActiveAt: Date.now(),
    totalTxCount: agent.totalTxCount + results.filter((r) => !r.blocked).length
  });
  const mainResult = results[0];
  return {
    success: true,
    action: mainResult?.action,
    reasoning: mainResult?.reasoning,
    blocked: mainResult?.blocked,
    blockReason: mainResult?.blockReason
  };
}
async function runAgentChat(agentId, userText) {
  const trimmed = userText.trim();
  if (!trimmed) return { reply: "", error: "Empty message" };
  const agent = getAgent(agentId);
  if (!agent) return { reply: "", error: "Agent not found" };
  if (agent.status !== "active") {
    return { reply: "", error: `Agent is ${agent.status} \u2014 resume it to chat.` };
  }
  let context = getContext(agentId);
  if (!context) {
    const prompt = buildSystemPrompt(
      agent.strategyId,
      agent.commonRules,
      agent.specificRules,
      { solBalance: 0, usdcBalance: 0, dailySpent: 0 }
    );
    context = initContext(agentId, prompt);
  }
  if (Date.now() >= context.state.dailyResetAt) {
    context.state.dailySpent = 0;
    context.state.dailyResetAt = nextDailyReset();
  }
  const systemPrompt = buildSystemPrompt(
    agent.strategyId,
    agent.commonRules,
    agent.specificRules,
    {
      solBalance: context.state.solBalance,
      usdcBalance: context.state.usdcBalance,
      dailySpent: context.state.dailySpent
    }
  );
  if (context.messages[0]?.content !== systemPrompt) {
    context.messages[0] = { role: "system", content: systemPrompt, timestamp: Date.now() };
  }
  const userMsg = { role: "user", content: trimmed, timestamp: Date.now() };
  addMessages(agentId, [userMsg]);
  context = getContext(agentId);
  const skills = getSkillsForStrategy(agent.strategyId);
  const enabledSkills = getEnabledSkills(skills);
  const historyForApi = context.messages.slice(1, -1);
  let llmResponse;
  try {
    llmResponse = await callLlm({
      systemPrompt: context.messages[0].content,
      messages: historyForApi,
      tools: enabledSkills,
      userMessage: trimmed
    });
  } catch (err) {
    log6.error(`Chat LLM failed for ${agent.handle}`, { error: String(err) });
    return { reply: "", error: `LLM error: ${String(err)}` };
  }
  const assistantMsg = {
    role: "assistant",
    content: llmResponse.content,
    toolCalls: llmResponse.toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments
    })),
    timestamp: Date.now()
  };
  context.messages.push(assistantMsg);
  const toolLines = [];
  for (const tc of llmResponse.toolCalls) {
    const policy = checkPolicy(
      tc.name,
      tc.arguments,
      agent.commonRules,
      agent.specificRules,
      context.state.dailySpent
    );
    let result;
    let status;
    if (!policy.allowed) {
      result = `BLOCKED: ${policy.reason}`;
      status = "blocked";
    } else {
      const execution = executeToolCall(tc.name, tc.arguments, {
        solBalance: context.state.solBalance,
        usdcBalance: context.state.usdcBalance
      });
      result = execution.result;
      status = "executed";
      if (execution.stateChange) {
        context.state.solBalance += execution.stateChange.solBalance ?? 0;
        context.state.usdcBalance += execution.stateChange.usdcBalance ?? 0;
        const spent = Math.abs(
          (execution.stateChange.usdcBalance ?? 0) + (execution.stateChange.solBalance ?? 0) * 130
        );
        context.state.dailySpent += spent;
      }
    }
    const decision = {
      id: uuid2(),
      action: tc.name,
      params: tc.arguments,
      reasoning: llmResponse.content ?? "Chat tool call",
      status,
      blockReason: status === "blocked" ? policy.reason : void 0,
      timestamp: Date.now()
    };
    context.decisions.push(decision);
    const toolMsg = {
      role: "tool",
      content: result,
      toolCallId: tc.id,
      timestamp: Date.now()
    };
    context.messages.push(toolMsg);
    const short = result.length > 700 ? `${result.slice(0, 700)}\u2026` : result;
    toolLines.push(
      status === "blocked" ? `**${tc.name}** (blocked): ${policy.reason}` : `**${tc.name}**
${short}`
    );
  }
  if (llmResponse.toolCalls.length === 0 && llmResponse.content?.trim()) {
    context.decisions.push({
      id: uuid2(),
      action: "chat_reply",
      params: {},
      reasoning: llmResponse.content,
      status: "executed",
      timestamp: Date.now()
    });
  }
  context.updatedAt = Date.now();
  updateAgentState(agentId, { lastActiveAt: Date.now() });
  persistAll2();
  const reply = [llmResponse.content?.trim(), toolLines.length ? toolLines.join("\n\n") : ""].filter(Boolean).join("\n\n") || (toolLines.length ? toolLines.join("\n\n") : "I processed your message.");
  return { reply };
}

// src/services/scheduler.ts
var CYCLE_INTERVAL_MS = parseInt(process.env.AGENT_CYCLE_MS ?? "60000", 10);
var PERSIST_INTERVAL_MS = parseInt(process.env.PERSIST_MS ?? "30000", 10);
var log7 = createLogger("scheduler");
var schedulerTimer = null;
var persistTimer = null;
var isRunning = false;
var stats = {
  running: false,
  cycleIntervalMs: CYCLE_INTERVAL_MS,
  persistIntervalMs: PERSIST_INTERVAL_MS,
  activeAgents: 0,
  totalCycles: 0,
  lastCycleAt: null,
  cyclesByAgent: {}
};
async function tickAllAgents() {
  if (isRunning) return;
  isRunning = true;
  try {
    const agents2 = getActiveAgents();
    stats.activeAgents = agents2.length;
    if (agents2.length === 0) {
      isRunning = false;
      return;
    }
    log7.info(`Waking ${agents2.length} active agents`);
    const batchSize = 5;
    for (let i = 0; i < agents2.length; i += batchSize) {
      const batch = agents2.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(
          (agent) => runAgentCycle(agent.id).then((result) => {
            stats.totalCycles++;
            stats.cyclesByAgent[agent.handle] = (stats.cyclesByAgent[agent.handle] ?? 0) + 1;
            return { handle: agent.handle, result };
          })
        )
      );
      for (const r of results) {
        if (r.status === "rejected") {
          log7.error("Agent cycle failed", { reason: String(r.reason) });
        } else if (!r.value.result.success) {
          log7.warn(`${r.value.handle}: ${r.value.result.error}`);
        } else {
          const { action, blocked, blockReason } = r.value.result;
          if (blocked) {
            log7.info(`${r.value.handle}: ${action} \u2192 BLOCKED`, { reason: blockReason });
          } else {
            log7.info(`${r.value.handle}: ${action ?? "observed"}`);
          }
        }
      }
    }
    stats.lastCycleAt = Date.now();
  } catch (err) {
    log7.error("Scheduler cycle failed", { error: String(err) });
  } finally {
    isRunning = false;
  }
}
function persistAllData() {
  persistAll();
  persistAll2();
}
function startScheduler() {
  if (schedulerTimer) return;
  log7.info(`Scheduler started \u2014 cycle: ${CYCLE_INTERVAL_MS / 1e3}s, persist: ${PERSIST_INTERVAL_MS / 1e3}s`);
  tickAllAgents();
  schedulerTimer = setInterval(tickAllAgents, CYCLE_INTERVAL_MS);
  persistTimer = setInterval(persistAllData, PERSIST_INTERVAL_MS);
  stats.running = true;
}
function getSchedulerStats() {
  return { ...stats };
}
async function triggerAgentNow(agentId) {
  return runAgentCycle(agentId);
}

// src/routes/agent-run.ts
var agentRunRouter = new Hono2();
agentRunRouter.get("/_scheduler", (c) => {
  const stats2 = getSchedulerStats();
  return c.json(stats2);
});
var chatBodySchema = z2.object({
  message: z2.string().min(1).max(8e3)
});
agentRunRouter.post("/:id/chat", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  let body;
  try {
    body = chatBodySchema.parse(await c.req.json());
  } catch {
    return c.json({ error: 'Invalid JSON body (expected { "message": string })' }, 400);
  }
  const result = await runAgentChat(id, body.message);
  if (result.error) {
    const status = result.error.startsWith("LLM error") ? 502 : 400;
    return c.json({ error: result.error }, status);
  }
  return c.json({ reply: result.reply });
});
agentRunRouter.post("/:id/run", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  if (agent.status !== "active") return c.json({ error: `Agent is ${agent.status} \u2014 resume it first` }, 400);
  const result = await triggerAgentNow(id);
  return c.json(result);
});
agentRunRouter.get("/:id/context", requireAuth(), (c) => {
  const wallet = c.get("wallet");
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
    updatedAt: context.updatedAt
  });
});
agentRunRouter.get("/:id/decisions", requireAuth(), (c) => {
  const wallet = c.get("wallet");
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
agentRunRouter.get("/:id/skills", requireAuth(), (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  const skills = getSkillsForStrategy(agent.strategyId);
  return c.json({ skills, strategyId: agent.strategyId });
});

// src/routes/health.ts
import { Hono as Hono3 } from "hono";
var healthRouter = new Hono3();
healthRouter.get("/", (c) => {
  return c.json({
    status: "ok",
    timestamp: Date.now(),
    llmModel: getLlmModel(),
    uptime: process.uptime()
  });
});

// src/routes/lifi.ts
import { Hono as Hono4 } from "hono";
import { z as z3 } from "zod";
var LIFI_QUOTE = "https://li.quest/v1/quote";
var quoteQuerySchema = z3.object({
  fromChain: z3.string().min(1),
  toChain: z3.string().min(1),
  fromToken: z3.string().min(1),
  toToken: z3.string().min(1),
  fromAmount: z3.string().min(1),
  fromAddress: z3.string().optional(),
  toAddress: z3.string().optional(),
  order: z3.enum(["CHEAPEST", "FASTEST"]).optional()
});
var lifiRouter = new Hono4();
lifiRouter.get("/quote", async (c) => {
  const parsed = quoteQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "Invalid quote query", issues: parsed.error.flatten() }, 400);
  }
  const q = parsed.data;
  const url2 = new URL(LIFI_QUOTE);
  url2.searchParams.set("integrator", process.env.LIFI_INTEGRATOR ?? "oishi");
  url2.searchParams.set("fromChain", q.fromChain);
  url2.searchParams.set("toChain", q.toChain);
  url2.searchParams.set("fromToken", q.fromToken);
  url2.searchParams.set("toToken", q.toToken);
  url2.searchParams.set("fromAmount", q.fromAmount);
  url2.searchParams.set("order", q.order ?? "CHEAPEST");
  if (q.fromAddress?.trim()) url2.searchParams.set("fromAddress", q.fromAddress.trim());
  if (q.toAddress?.trim()) url2.searchParams.set("toAddress", q.toAddress.trim());
  const headers = { Accept: "application/json" };
  const key2 = process.env.LIFI_API_KEY;
  if (key2) headers["x-lifi-api-key"] = key2;
  const res = await fetch(url2.toString(), { headers });
  const bodyText = await res.text();
  try {
    const json = JSON.parse(bodyText);
    return Response.json(json, { status: res.status });
  } catch {
    const status = res.status >= 400 ? res.status : 502;
    return new Response(bodyText || "upstream error", { status });
  }
});

// src/routes/auth.ts
import { Hono as Hono5 } from "hono";
init_jwt();
init_logger();
var log8 = createLogger("auth");
var authRouter = new Hono5();
authRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const wallet = c.req.header("x-oishi-wallet");
  if (!wallet) {
    return c.json({ error: "Missing x-oishi-wallet header" }, 400);
  }
  const { message, signature } = body;
  if (!message || !signature) {
    return c.json({ error: "Missing message or signature in body" }, 400);
  }
  const auth = { wallet, signature, message };
  if (!verifyWalletSignature(auth)) {
    return c.json({ error: "Invalid wallet signature" }, 401);
  }
  try {
    const parsed = JSON.parse(message);
    const age = Date.now() - parsed.timestamp;
    if (age > 5 * 60 * 1e3) {
      return c.json({ error: "Signature expired (>5 min old)" }, 401);
    }
  } catch {
    return c.json({ error: "Invalid message format" }, 400);
  }
  const token = await signToken(wallet);
  log8.info(`User authenticated: ${wallet.slice(0, 8)}...`);
  return c.json({
    token,
    wallet,
    expiresIn: process.env.JWT_EXPIRY ?? "7d"
  });
});
authRouter.get("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "No token" }, 401);
  const payload = await (await Promise.resolve().then(() => (init_jwt(), jwt_exports))).verifyToken(token);
  if (!payload) return c.json({ error: "Token invalid or expired" }, 401);
  return c.json({ wallet: payload.wallet, expiresAt: new Date(payload.exp * 1e3).toISOString() });
});

// src/routes/onchain.ts
import { Hono as Hono6 } from "hono";
import { PublicKey as PublicKey2 } from "@solana/web3.js";

// src/solana/registry.ts
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";

// src/solana/hoshi_agent_registry.json
var hoshi_agent_registry_default = {
  address: "EdsJZDNVQ2ncXrXaTFd2aZFhrYqLBJGJBq6xAY26PR9a",
  metadata: {
    name: "hoshi_agent_registry",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Oishi Agent Registry \u2014 on-chain agent profiles"
  },
  instructions: [
    {
      name: "add_strategy",
      docs: [
        "Add a strategy to the agent's active set."
      ],
      discriminator: [
        64,
        123,
        127,
        227,
        192,
        234,
        198,
        20
      ],
      accounts: [
        {
          name: "owner",
          signer: true,
          relations: [
            "agent"
          ]
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent.handle",
                account: "AgentAccount"
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "strategy",
          type: {
            defined: {
              name: "StrategyId"
            }
          }
        }
      ]
    },
    {
      name: "link_kya_identity",
      docs: [
        "Link agent to a KYA identity PDA."
      ],
      discriminator: [
        204,
        84,
        59,
        193,
        165,
        122,
        222,
        34
      ],
      accounts: [
        {
          name: "owner",
          signer: true,
          relations: [
            "agent"
          ]
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent.handle",
                account: "AgentAccount"
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "kya_identity",
          type: "pubkey"
        }
      ]
    },
    {
      name: "register_agent",
      docs: [
        "Register a new agent with one or more strategies (bitmask)."
      ],
      discriminator: [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      accounts: [
        {
          name: "owner",
          writable: true,
          signer: true
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "arg",
                path: "handle"
              }
            ]
          }
        },
        {
          name: "system_program",
          address: "11111111111111111111111111111111"
        }
      ],
      args: [
        {
          name: "handle",
          type: "string"
        },
        {
          name: "display_name",
          type: "string"
        },
        {
          name: "strategy_mask",
          type: "u16"
        },
        {
          name: "rules_hash",
          type: {
            array: [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      name: "remove_strategy",
      docs: [
        "Remove a strategy from the agent's active set."
      ],
      discriminator: [
        185,
        238,
        33,
        91,
        134,
        210,
        97,
        26
      ],
      accounts: [
        {
          name: "owner",
          signer: true,
          relations: [
            "agent"
          ]
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent.handle",
                account: "AgentAccount"
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "strategy",
          type: {
            defined: {
              name: "StrategyId"
            }
          }
        }
      ]
    },
    {
      name: "set_agent_status",
      docs: [
        "Set agent status (pause / resume / stop)."
      ],
      discriminator: [
        31,
        193,
        64,
        189,
        114,
        155,
        164,
        218
      ],
      accounts: [
        {
          name: "owner",
          signer: true,
          relations: [
            "agent"
          ]
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent.handle",
                account: "AgentAccount"
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "status",
          type: {
            defined: {
              name: "AgentStatus"
            }
          }
        }
      ]
    },
    {
      name: "transfer_ownership",
      docs: [
        "Transfer agent ownership to a new wallet."
      ],
      discriminator: [
        65,
        177,
        215,
        73,
        53,
        45,
        99,
        47
      ],
      accounts: [
        {
          name: "owner",
          signer: true,
          relations: [
            "agent"
          ]
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent.handle",
                account: "AgentAccount"
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "new_owner",
          type: "pubkey"
        }
      ]
    },
    {
      name: "update_agent",
      docs: [
        "Update agent metadata (display name, rules hash, metadata URI)."
      ],
      discriminator: [
        85,
        2,
        178,
        9,
        119,
        139,
        102,
        164
      ],
      accounts: [
        {
          name: "owner",
          signer: true,
          relations: [
            "agent"
          ]
        },
        {
          name: "agent",
          writable: true,
          pda: {
            seeds: [
              {
                kind: "const",
                value: [
                  97,
                  103,
                  101,
                  110,
                  116
                ]
              },
              {
                kind: "account",
                path: "agent.handle",
                account: "AgentAccount"
              }
            ]
          }
        }
      ],
      args: [
        {
          name: "display_name",
          type: {
            option: "string"
          }
        },
        {
          name: "rules_hash",
          type: {
            option: {
              array: [
                "u8",
                32
              ]
            }
          }
        },
        {
          name: "metadata_uri",
          type: {
            option: "string"
          }
        }
      ]
    }
  ],
  accounts: [
    {
      name: "AgentAccount",
      discriminator: [
        241,
        119,
        69,
        140,
        233,
        9,
        112,
        50
      ]
    }
  ],
  events: [
    {
      name: "AgentRegistered",
      discriminator: [
        191,
        78,
        217,
        54,
        232,
        100,
        189,
        85
      ]
    },
    {
      name: "AgentStatusChanged",
      discriminator: [
        210,
        74,
        73,
        158,
        205,
        28,
        137,
        178
      ]
    },
    {
      name: "OwnershipTransferred",
      discriminator: [
        172,
        61,
        205,
        183,
        250,
        50,
        38,
        98
      ]
    },
    {
      name: "StrategiesUpdated",
      discriminator: [
        46,
        137,
        231,
        167,
        169,
        136,
        234,
        233
      ]
    }
  ],
  errors: [
    {
      code: 6e3,
      name: "HandleTaken",
      msg: "Handle already registered"
    },
    {
      code: 6001,
      name: "NotOwner",
      msg: "Not the agent owner"
    },
    {
      code: 6002,
      name: "HandleTooLong",
      msg: "Handle too long \u2014 max 64 characters"
    },
    {
      code: 6003,
      name: "NoStrategySelected",
      msg: "At least one strategy must be selected"
    },
    {
      code: 6004,
      name: "CannotRemoveLastStrategy",
      msg: "Cannot remove the last strategy from an agent"
    }
  ],
  types: [
    {
      name: "AgentAccount",
      type: {
        kind: "struct",
        fields: [
          {
            name: "owner",
            type: "pubkey"
          },
          {
            name: "handle",
            type: "string"
          },
          {
            name: "display_name",
            type: "string"
          },
          {
            name: "strategy_mask",
            type: "u16"
          },
          {
            name: "rules_hash",
            type: {
              array: [
                "u8",
                32
              ]
            }
          },
          {
            name: "status",
            type: {
              defined: {
                name: "AgentStatus"
              }
            }
          },
          {
            name: "kya_identity",
            type: "pubkey"
          },
          {
            name: "metadata_uri",
            type: "string"
          },
          {
            name: "created_at",
            type: "i64"
          },
          {
            name: "updated_at",
            type: "i64"
          },
          {
            name: "bump",
            type: "u8"
          }
        ]
      }
    },
    {
      name: "AgentRegistered",
      type: {
        kind: "struct",
        fields: [
          {
            name: "owner",
            type: "pubkey"
          },
          {
            name: "handle",
            type: "string"
          },
          {
            name: "strategy_mask",
            type: "u16"
          },
          {
            name: "strategy_count",
            type: "u8"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "AgentStatus",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Active"
          },
          {
            name: "Paused"
          },
          {
            name: "Stopped"
          },
          {
            name: "Blocked"
          }
        ]
      }
    },
    {
      name: "AgentStatusChanged",
      type: {
        kind: "struct",
        fields: [
          {
            name: "handle",
            type: "string"
          },
          {
            name: "status",
            type: "u8"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "OwnershipTransferred",
      type: {
        kind: "struct",
        fields: [
          {
            name: "handle",
            type: "string"
          },
          {
            name: "old_owner",
            type: "pubkey"
          },
          {
            name: "new_owner",
            type: "pubkey"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "StrategiesUpdated",
      type: {
        kind: "struct",
        fields: [
          {
            name: "handle",
            type: "string"
          },
          {
            name: "strategy_mask",
            type: "u16"
          },
          {
            name: "timestamp",
            type: "i64"
          }
        ]
      }
    },
    {
      name: "StrategyId",
      type: {
        kind: "enum",
        variants: [
          {
            name: "Polymarket"
          },
          {
            name: "Meteora"
          },
          {
            name: "Kamino"
          },
          {
            name: "Sanctum"
          },
          {
            name: "Drift"
          },
          {
            name: "Jupiter"
          },
          {
            name: "Raydium"
          },
          {
            name: "Marginfi"
          }
        ]
      }
    }
  ]
};

// src/solana/registry.ts
init_logger();
import { createHash } from "node:crypto";
var log9 = createLogger("solana");
var PROGRAM_ID = new PublicKey(hoshi_agent_registry_default.address);
var RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
function getProgram() {
  const connection = new Connection(RPC, "confirmed");
  const wallet = {
    signTransaction: async () => {
      throw new Error("No wallet");
    },
    signAllTransactions: async () => {
      throw new Error("No wallet");
    },
    publicKey: PublicKey.default
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(hoshi_agent_registry_default, provider);
}
function findAgentPda(handle) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), Buffer.from(handle)],
    PROGRAM_ID
  );
  return pda;
}
var STRATEGY_BITS = {
  polymarket: 0,
  meteora: 1,
  kamino: 2,
  sanctum: 3,
  drift: 4,
  jupiter: 5,
  raydium: 6,
  marginfi: 7
};
function buildStrategyMask(strategyIds) {
  let mask = 0;
  for (const id of strategyIds) mask |= 1 << (STRATEGY_BITS[id] ?? 99);
  return mask;
}
function hashRules(rules) {
  return Array.from(createHash("sha256").update(JSON.stringify(rules)).digest());
}
async function buildRegisterAgentTx(params) {
  const program = getProgram();
  const pda = findAgentPda(params.handle);
  const rulesHash = hashRules(params.rules);
  const tx = await program.methods.registerAgent(params.handle, params.displayName, params.strategyMask, rulesHash).accounts({ owner: params.owner, agent: pda, systemProgram: SystemProgram.programId }).transaction();
  const connection = new Connection(RPC, "confirmed");
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = params.owner;
  log9.info(`Built register_agent tx`, { handle: params.handle, pda: pda.toBase58() });
  return { transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"), pda: pda.toBase58() };
}

// src/routes/onchain.ts
var onchainRouter = new Hono6();
onchainRouter.post("/register-agent/:id", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);
  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);
  try {
    const owner = new PublicKey2(wallet);
    const strategyMask = buildStrategyMask([agent.strategyId]);
    const { transaction, pda } = await buildRegisterAgentTx({
      owner,
      handle: agent.handle.replace("@", ""),
      // strip @ for PDA seed
      displayName: agent.displayName,
      strategyMask,
      rules: { common: agent.commonRules, specific: agent.specificRules }
    });
    return c.json({
      transaction,
      pda,
      handle: agent.handle,
      programId: "EdsJZDNVQ2ncXrXaTFd2aZFhrYqLBJGJBq6xAY26PR9a",
      instructions: "Frontend: deserialize tx \u2192 sign with wallet \u2192 send to Solana devnet",
      estimatedFee: "~0.003 SOL"
    });
  } catch (err) {
    return c.json({ error: `Failed to build transaction: ${String(err)}` }, 500);
  }
});

// src/main.ts
init_logger();
var logger = createLogger("server");
var app = new Hono7();
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization", "x-oishi-wallet", "x-oishi-signature", "x-oishi-message"],
  exposeHeaders: [],
  maxAge: 86400
}));
app.route("/api/health", healthRouter);
app.route("/api/lifi", lifiRouter);
app.route("/api/auth", authRouter);
app.route("/api/onchain", onchainRouter);
app.route("/api/agents", agentRunRouter);
app.route("/api/agents", agentsRouter);
app.get(
  "/",
  (c) => c.json({
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
      scheduler: "/api/agents/_scheduler"
    }
  })
);
void loadFromSupabase().then(() => {
  startScheduler();
});
var main_default = app;
var isBun = typeof Bun !== "undefined";
if (!isBun && !process.env.VERCEL) {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  serve({ fetch: app.fetch, port }, (info) => {
    logger.info(`Oishi Agent Backend running on http://localhost:${info.port}`);
    logger.info(`LLM: ${getLlmDebugInfo()}`);
    logger.info(
      `Scheduler: waking active agents every ${parseInt(process.env.AGENT_CYCLE_MS ?? "60000", 10) / 1e3}s`
    );
  });
}
export {
  main_default as default
};
