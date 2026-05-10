import { z } from "zod";

// ── Strategy IDs (mirrors frontend agent-strategies.ts) ──────────────
export const STRATEGY_IDS = [
  "polymarket",
  "meteora",
  "kamino",
  "sanctum",
  "drift",
  "jupiter",
  "raydium",
  "marginfi",
] as const;

export type StrategyId = (typeof STRATEGY_IDS)[number];

export const STRATEGY_CONFIG = {
  polymarket: { protocol: "Polymarket", name: "Prediction mark", risk: "high", category: "Trading", abbrev: "PM" },
  meteora:    { protocol: "Meteora", name: "Dynamic LP", risk: "medium", category: "Liquidity", abbrev: "ME" },
  kamino:     { protocol: "Kamino", name: "Lend & earn", risk: "low", category: "Yield", abbrev: "KM" },
  sanctum:    { protocol: "Sanctum", name: "Liquid stake", risk: "low", category: "Staking", abbrev: "SC" },
  drift:      { protocol: "Drift", name: "Perps & spots", risk: "high", category: "Trading", abbrev: "DR" },
  jupiter:    { protocol: "Jupiter", name: "Swap & DCA", risk: "medium", category: "Trading", abbrev: "JP" },
  raydium:    { protocol: "Raydium", name: "AMM LP", risk: "medium", category: "Liquidity", abbrev: "RD" },
  marginfi:   { protocol: "marginfi", name: "Lend & borrow", risk: "high", category: "Yield", abbrev: "MF" },
} as const;

// ── Common rules (all strategies) ─────────────────────────────────────
export const CommonRulesSchema = z.object({
  dailyCapUsd: z.number().min(5).max(10000).default(75),
  maxPerTxUsd: z.number().min(1).max(5000).default(35),
  notifyOnBlock: z.boolean().default(true),
  quietHoursEnabled: z.boolean().default(false),
});
export type CommonRules = z.infer<typeof CommonRulesSchema>;

export const defaultCommonRules: CommonRules = {
  dailyCapUsd: 75,
  maxPerTxUsd: 35,
  notifyOnBlock: true,
  quietHoursEnabled: false,
};

// ── Strategy-specific rules ───────────────────────────────────────────
export type SpecificRules = Record<string, number | boolean>;

export const DEFAULT_SPECIFIC: Record<StrategyId, SpecificRules> = {
  polymarket: { maxPosition: 50, liquidOnly: true },
  meteora:    { ilTolerance: 40, autoRebal: true },
  kamino:     { apyLean: 45, stableOnly: true },
  sanctum:    { maxLstPct: 60, jitoPrefer: false },
  drift:      { maxLev: 3, isolated: true },
  jupiter:    { slippageBps: 50, auditedRoutes: true },
  raydium:    { maxPoolPct: 35, concentrated: false },
  marginfi:   { maxLtv: 55, borrowOff: false },
};

// ── Agent status ───────────────────────────────────────────────────────
export const AGENT_STATUSES = ["active", "paused", "stopped", "blocked"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// ── Agent record ───────────────────────────────────────────────────────
export interface Agent {
  id: string;
  owner: string; // Solana wallet pubkey (base58)
  handle: string; // "@name.oishi"
  displayName: string;
  strategyId: StrategyId;
  commonRules: CommonRules;
  specificRules: SpecificRules;
  status: AgentStatus;
  kyaIdentityPda: string | null;
  kyaReputationScore: number;
  attestationCount: number;
  totalEarnings: number;
  totalTxCount: number;
  cycleCount: number;
  createdAt: number;
  updatedAt: number;
  lastActiveAt: number | null;
}

// ── Create agent input ─────────────────────────────────────────────────
export const CreateAgentSchema = z.object({
  displayName: z.string().min(1).max(48),
  handle: z.string().min(3).max(30).regex(/^@[a-z0-9][a-z0-9-]*[a-z0-9]\.oishi$/, "Invalid handle format"),
  strategyId: z.enum(STRATEGY_IDS),
  commonRules: CommonRulesSchema.optional().default(defaultCommonRules),
  specificRules: z.record(z.string(), z.union([z.number(), z.boolean()])).optional().default({}),
});
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export const UpdateRulesSchema = z.object({
  commonRules: CommonRulesSchema.optional(),
  specificRules: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
});
export type UpdateRulesInput = z.infer<typeof UpdateRulesSchema>;
