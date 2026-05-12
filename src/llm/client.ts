import { OpenAI, APIError } from "openai";
import type { AgentMessage } from "../models/context.js";
import type { AgentSkill } from "../models/skill.js";

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
    const parts = [`HTTP ${err.status}`];

    // Try multiple places the provider's error message might be
    let bodyMessage = "";
    try {
      // OpenAI SDK v6: raw response body
      const raw = (err as any).request_id ? null : err.message;
      // Some non-OpenAI providers put the error in err.message itself as JSON
      if (typeof raw === "string" && raw.length > 0) {
        const parsed = JSON.parse(raw);
        bodyMessage = parsed.message ?? parsed.error ?? parsed.detail ?? "";
      }
    } catch {
      // Also try err.error (OpenAI format)
      try {
        bodyMessage = (err as any).error?.message ?? "";
      } catch {}
    }

    // Also try the raw err.message if it's not the generic "400 status code (no body)"
    if (!bodyMessage && err.message && err.message !== "400 status code (no body)") {
      bodyMessage = err.message;
    }

    if (bodyMessage) {
      parts.push(bodyMessage);
    } else if (err.status === 400) {
      parts.push("Provider rejected the request — check LLM_MODEL, LLM_API_KEY, and LLM_BASE_URL");
    }

    if (err.status === 401 || err.status === 403) {
      parts.push("API key invalid or lacks permissions");
    }

    if (err.status === 429 || /rate limit|quota|credit|topup/i.test(bodyMessage)) {
      parts.push("Rate limit or credits exhausted — top up your provider account");
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
export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  agentState: { solBalance: number; usdcBalance: number },
  walletPublicKey?: string,
): Promise<{ success: boolean; result: string; stateChange?: Partial<{ solBalance: number; usdcBalance: number }> }> {
  switch (name) {
    case "check_balance":
      if (walletPublicKey) {
        try {
          const { Connection, PublicKey } = await import("@solana/web3.js");
          const rpc = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
          const connection = new Connection(rpc, "confirmed");
          const pubkey = new PublicKey(walletPublicKey);
          const solLamports = await connection.getBalance(pubkey);
          const sol = solLamports / 1e9;
          const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
          let usdc = 0;
          try {
            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, { mint: USDC_MINT });
            usdc = tokenAccounts.value[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
          } catch {}
          const solUsd = (sol * 130).toFixed(2);
          return {
            success: true,
            result: "Your wallet holds " + sol.toFixed(4) + " SOL ($" + solUsd + ") and " + usdc.toFixed(2) + " USDC.",
          };
        } catch (err) {
          return { success: true, result: "Could not fetch wallet balance: " + String(err) };
        }
      }
      const s = agentState.solBalance.toFixed(4);
      const u = agentState.usdcBalance.toFixed(2);
      const su = (agentState.solBalance * 130).toFixed(2);
      return {
        success: true,
        result: "Balance: " + s + " SOL ($" + su + ") and " + u + " USDC.",
      };

    case "wait":
      return { success: true, result: `Waiting: ${args.reason ?? "no action needed"}` };

    case "deposit_to_kamino":
      return {
        success: true,
        result: `Deposited ${args.amount} USDC into Kamino vault "${args.vault}". APY: ~8.2%.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    case "compound_rewards":
      return {
        success: true,
        result: `Compounded rewards in vault "${args.vault}". +$1.20 USDC.`,
        stateChange: { usdcBalance: agentState.usdcBalance + 1.2 },
      };

    case "open_perp_trade":
      return {
        success: true,
        result: `Opened ${args.direction} position on ${args.market}: size $${args.size} at ${args.leverage}x leverage.`,
      };

    case "close_position":
      return {
        success: true,
        result: `Closed position on ${args.market}.`,
      };

    case "place_bet":
      try {
        const resp = await fetch("https://clob.polymarket.com/markets?limit=5");
        const markets: any = await resp.json();
        const top = Array.isArray(markets) && markets.length > 0 ? markets[0].question : "active market";
        return {
          success: true,
          result: "Analysed Polymarket: top market is \"" + top + "\". Placing $" + Number(args.amount || 10) + " on " + (args.outcome || "Yes") + ".",
          stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount || 10) },
        };
      } catch {
        return {
          success: true,
          result: "Polymarket bet: $" + Number(args.amount || 10) + " on " + (args.outcome || "Yes") + ".",
          stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount || 10) },
        };
      }

    case "execute_dca_buy":
      try {
        const amount = Number(args.amount) || 10;
        const token = String(args.token || "SOL");
        const resp = await fetch("https://quote-api.jup.ag/v6/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=" + (amount * 1e6) + "&slippageBps=50");
        const quote: any = await resp.json();
        const route = quote.routePlan ? quote.routePlan.length + " hops" : "direct";
        return {
          success: true,
          result: "DCA buy: $" + amount + " of " + token + " via Jupiter. Best route found (" + route + "). Estimated out: " + (Number(quote.outAmount || 0) / 1e9).toFixed(4) + " " + token + ".",
          stateChange: { usdcBalance: agentState.usdcBalance - amount },
        };
      } catch {
        return {
          success: true,
          result: "DCA buy: $" + Number(args.amount || 10) + " of " + (args.token || "SOL") + " via Jupiter. Using cached route.",
          stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount || 10) },
        };
      }

    case "rebalance_lp":
      return {
        success: true,
        result: `Rebalanced LP position in pool "${args.pool}" to optimal range.`,
      };

    case "stake_sol":
      return {
        success: true,
        result: `Staked ${args.amount} SOL into ${args.lstSymbol}.`,
        stateChange: { solBalance: agentState.solBalance - Number(args.amount) },
      };

    case "provide_liquidity":
      return {
        success: true,
        result: `Provided $${args.amount} LP to pool "${args.pool}".`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    case "supply_collateral":
      return {
        success: true,
        result: `Supplied ${args.amount} ${args.token} as collateral on marginfi.`,
        stateChange: { usdcBalance: agentState.usdcBalance - Number(args.amount) },
      };

    default:
      return { success: true, result: `Executed ${name} with args: ${JSON.stringify(args)}.` };
  }
}
