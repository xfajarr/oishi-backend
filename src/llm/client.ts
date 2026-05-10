import { OpenAI, APIError } from "openai";
import type { AgentMessage } from "../models/context";
import type { AgentSkill } from "../models/skill";

type ChatCompletionMessageParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type ChatCompletionTool = OpenAI.Chat.Completions.ChatCompletionTool;
type ChatCompletionMessageToolCall = OpenAI.Chat.Completions.ChatCompletionMessageToolCall;

// ── OpenAI-compatible client (works with fetch.ai, tokenrouter, LM Studio, etc.) ──
/** Many providers need the path `/v1` (full URL e.g. `https://api.openai.com/v1`). Missing it yields HTTP 400 with an empty body. */
function normalizeLlmBaseUrl(raw: string): string {
  const u = raw.trim().replace(/\/+$/, "");
  if (!u) return "https://api.openai.com/v1";
  if (/\/v1$/i.test(u) || /\/v1\//i.test(u)) return u;
  return `${u}/v1`;
}

const LLM_BASE_URL = normalizeLlmBaseUrl(process.env.LLM_BASE_URL ?? "https://api.openai.com/v1");
const LLM_API_KEY = process.env.LLM_API_KEY ?? "sk-missing";
const LLM_MODEL = process.env.LLM_MODEL ?? "gpt-4o";
const LLM_DISABLE_TOOLS = process.env.LLM_DISABLE_TOOLS === "1";

const client = new OpenAI({
  baseURL: LLM_BASE_URL,
  apiKey: LLM_API_KEY,
});

function formatLlmFailure(err: unknown): string {
  if (err instanceof APIError) {
    // Try to extract a useful message from raw response body
    let bodyMessage = "";
    try {
      // @ts-expect-error — raw body may exist
      const raw = err.response?.body ?? err.message;
      if (typeof raw === "string" && raw.length > 0 && raw.length < 2000) {
        const parsed = JSON.parse(raw);
        bodyMessage = parsed.message ?? parsed.error ?? parsed.detail ?? "";
      }
    } catch { /* not JSON */ }

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

    if (err.status === 429 || (bodyMessage && /rate limit|quota|credit/i.test(bodyMessage))) {
      parts.push("Rate limit hit or account out of credits. Top up your LLM provider account.");
    }

    return parts.join(" · ");
  }
  return String(err);
}

/** For startup logs (uses normalized base URL). */
export function getLlmDebugInfo(): string {
  return `${LLM_MODEL} @ ${LLM_BASE_URL}`;
}

function agentMessageToOpenAI(m: AgentMessage): ChatCompletionMessageParam {
  if (m.role === "tool") {
    return {
      role: "tool",
      tool_call_id: m.toolCallId ?? "",
      content: m.content ?? "",
    };
  }
  if (m.role === "assistant" && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: m.content,
      tool_calls: m.toolCalls.map((tc: NonNullable<typeof m.toolCalls>[number]) => ({
        id: tc.id,
        type: "function" as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments ?? {}),
        },
      })),
    };
  }
  if (m.role === "user") {
    return { role: "user", content: m.content ?? "" };
  }
  return { role: "assistant", content: m.content ?? "" };
}

// ── Call LLM with agent context ────────────────────────────────────────
export interface LlmCallParams {
  systemPrompt: string;
  /** Conversation turns (no leading system message). Current user turn is passed as `userMessage`. */
  messages: AgentMessage[];
  tools: AgentSkill[];
  userMessage: string;
}

export interface LlmResponse {
  content: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export async function callLlm(params: LlmCallParams): Promise<LlmResponse> {
  const openaiTools = LLM_DISABLE_TOOLS ? [] : params.tools.map((t) => t.toolDefinition);

  const chatMessages = [
    { role: "system" as const, content: params.systemPrompt },
    ...params.messages.map(agentMessageToOpenAI),
    { role: "user" as const, content: params.userMessage },
  ];

  let response;
  try {
    response = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: chatMessages as ChatCompletionMessageParam[],
      tools: openaiTools.length > 0 ? (openaiTools as ChatCompletionTool[]) : undefined,
      tool_choice: openaiTools.length > 0 ? "auto" : undefined,
      temperature: 0.4,
      max_tokens: 1000,
      parallel_tool_calls: false,
    });
  } catch (err) {
    throw new Error(formatLlmFailure(err));
  }

  const choice = response.choices[0]?.message;
  return {
    content: choice?.content ?? null,
    toolCalls: (choice?.tool_calls ?? []).flatMap((tc: ChatCompletionMessageToolCall) => {
      if (tc.type !== "function") return [];
      return [
        {
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        },
      ];
    }),
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
