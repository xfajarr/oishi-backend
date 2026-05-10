import OpenAI from "openai";
import type { AgentSkill } from "../models/skill";

// ── OpenAI-compatible client (works with fetch.ai, tokenrouter, etc.) ──
const LLM_BASE_URL = process.env.LLM_BASE_URL ?? "https://api.openai.com/v1";
const LLM_API_KEY = process.env.LLM_API_KEY ?? "sk-missing";
const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o";

const client = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY,
});

// ── Call LLM with agent context ────────────────────────────────────────
export interface LlmCallParams {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant" | "tool"; content: string | null; toolCalls?: unknown[]; toolCallId?: string }>;
  tools: AgentSkill[];
  userMessage: string; // the current "what should I do?" prompt
}

export interface LlmResponse {
  content: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export async function callLlm(params: LlmCallParams): Promise<LlmResponse> {
  const openaiTools = params.tools.map((t) => t.toolDefinition);

  const chatMessages = [
    { role: "system" as const, content: params.systemPrompt },
    ...params.messages.map((m) => ({
      role: m.role as "user" | "assistant" | "tool",
      content: m.content,
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}),
    })),
    { role: "user" as const, content: params.userMessage },
  ];

  const response = await client.chat.completions.create({
    model: LLM_MODEL,
    messages: chatMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: openaiTools.length > 0 ? (openaiTools as OpenAI.Chat.Completions.ChatCompletionTool[]) : undefined,
    tool_choice: openaiTools.length > 0 ? "auto" : undefined,
    temperature: 0.4,
    max_tokens: 1000,
  });

  const choice = response.choices[0]?.message;
  return {
    content: choice?.content ?? null,
    toolCalls: (choice?.tool_calls ?? []).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    })),
  };
}

export function getLlmModel(): string {
  return LLM_MODEL;
}

// ── Tool result handler (simulated execution for now) ──────────────────
export function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  agentState: { solBalance: number; usdcBalance: number },
): { success: boolean; result: string; stateChange?: Partial<{ solBalance: number; usdcBalance: number }> } {
  switch (name) {
    case "check_balance":
      return {
        success: true,
        result: JSON.stringify({
          sol: agentState.solBalance,
          usdc: agentState.usdcBalance,
          solUsd: agentState.solBalance * 130,
          usdcUsd: agentState.usdcBalance,
        }),
      };

    case "wait":
      return { success: true, result: `Waiting: ${args.reason ?? "no action needed"}` };

    case "deposit_to_kamino":
      return {
        success: true,
        result: `[SIMULATED] Deposited ${args.amount} USDC into Kamino vault "${args.vault}". APY: ~8.2%.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    case "compound_rewards":
      return {
        success: true,
        result: `[SIMULATED] Compounded rewards in vault "${args.vault}". +$1.20 USDC.`,
        stateChange: { usdcBalance: agentState.usdcBalance + 1.2 },
      };

    case "open_perp_trade":
      return {
        success: true,
        result: `[SIMULATED] Opened ${args.direction} position on ${args.market}: size $${args.size} at ${args.leverage}x leverage.`,
      };

    case "close_position":
      return {
        success: true,
        result: `[SIMULATED] Closed position on ${args.market}.`,
      };

    case "place_bet":
      return {
        success: true,
        result: `[SIMULATED] Placed bet: $${args.amount} on "${args.outcome}" for market ${args.marketId}.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    case "execute_dca_buy":
      return {
        success: true,
        result: `[SIMULATED] DCA buy: $${args.amount} of ${args.token}. Bought at best Jupiter route.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    case "rebalance_lp":
      return {
        success: true,
        result: `[SIMULATED] Rebalanced LP position in pool "${args.pool}" to optimal range.`,
      };

    case "stake_sol":
      return {
        success: true,
        result: `[SIMULATED] Staked ${args.amount} SOL into ${args.lstSymbol}.`,
        stateChange: { solBalance: agentState.solBalance - Number(args.amount) },
      };

    case "provide_liquidity":
      return {
        success: true,
        result: `[SIMULATED] Provided $${args.amount} LP to pool "${args.pool}".`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    case "supply_collateral":
      return {
        success: true,
        result: `[SIMULATED] Supplied ${args.amount} ${args.token} as collateral on marginfi.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    default:
      return { success: true, result: `[SIMULATED] Executed ${name} with args: ${JSON.stringify(args)}.` };
  }
}
