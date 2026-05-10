// ── Agent context (persistent memory per agent) ────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string; // for tool result messages
  timestamp: number;
}

export interface AgentDecision {
  id: string;
  action: string; // e.g. "deposit_to_kamino", "open_perp_trade"
  params: Record<string, unknown>;
  reasoning: string;
  status: "executed" | "blocked" | "error";
  blockReason?: string; // if blocked: "Exceeds max per-tx $200"
  timestamp: number;
  txHash?: string;
}

export interface AgentState {
  solBalance: number;
  usdcBalance: number;
  solUsd: number;
  usdcUsd: number;
  positions: Record<string, unknown>; // strategy-specific positions
  dailySpent: number;
  dailyResetAt: number; // timestamp of next daily reset
  lastCycleAt: number | null;
}

export interface AgentContext {
  agentId: string;
  sessionId: string;
  systemPrompt: string;
  messages: AgentMessage[];
  decisions: AgentDecision[];
  state: AgentState;
  memory: Record<string, unknown>; // persistent key-value memory
  createdAt: number;
  updatedAt: number;
}

// ── Default context ────────────────────────────────────────────────────
export function createDefaultContext(
  agentId: string,
  systemPrompt: string,
): AgentContext {
  return {
    agentId,
    sessionId: agentId, // one session per agent for now
    systemPrompt,
    messages: [
      {
        role: "system",
        content: systemPrompt,
        timestamp: Date.now(),
      },
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
      lastCycleAt: null,
    },
    memory: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function nextDailyReset(): number {
  const now = new Date();
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.getTime();
}
