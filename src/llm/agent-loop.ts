import { v4 as uuid } from "uuid";
import { getAgent, updateAgentState } from "../services/agent-store";
import {
  getContext,
  initContext,
  addMessages,
  persistAll as persistContexts,
} from "../services/context-store";
import { getSkillsForStrategy } from "../models/skill";
import { callLlm, executeToolCall } from "./client";
import { buildSystemPrompt } from "./prompts";
import { checkPolicy, getEnabledSkills } from "./tools";
import type { AgentMessage, AgentDecision } from "../models/context";
import { createLogger } from "../lib/logger";
import { nextDailyReset } from "../models/context";

// ── Run one cycle for a single agent ───────────────────────────────────
const log = createLogger("agent-loop");

export async function runAgentCycle(agentId: string): Promise<{
  success: boolean;
  action?: string;
  reasoning?: string;
  blocked?: boolean;
  blockReason?: string;
  error?: string;
}> {
  // 1. LOAD ────────────────────────────────────────────────────────────
  const agent = getAgent(agentId);
  if (!agent) return { success: false, error: "Agent not found" };
  if (agent.status !== "active") return { success: false, error: `Agent is ${agent.status}` };

  let context = getContext(agentId);
  if (!context) {
    const prompt = buildSystemPrompt(
      agent.strategyId,
      agent.commonRules,
      agent.specificRules,
      { solBalance: 0, usdcBalance: 0, dailySpent: 0 },
    );
    context = initContext(agentId, prompt);
  }

  // Reset daily counter if needed
  if (Date.now() >= context.state.dailyResetAt) {
    context.state.dailySpent = 0;
    context.state.dailyResetAt = nextDailyReset();
  }

  // 2. BUILD ───────────────────────────────────────────────────────────
  const skills = getSkillsForStrategy(agent.strategyId);
  const enabledSkills = getEnabledSkills(skills);

  const systemPrompt = buildSystemPrompt(
    agent.strategyId,
    agent.commonRules,
    agent.specificRules,
    {
      solBalance: context.state.solBalance,
      usdcBalance: context.state.usdcBalance,
      dailySpent: context.state.dailySpent,
    },
  );

  // Update the system message if prompt changed
  if (context.messages[0]?.content !== systemPrompt) {
    context.messages[0] = { role: "system", content: systemPrompt, timestamp: Date.now() };
  }

  // 3. CALL ────────────────────────────────────────────────────────────
  let llmResponse;
  try {
    llmResponse = await callLlm({
      systemPrompt,
      messages: context.messages.slice(1), // skip system message (already in systemPrompt param)
      tools: enabledSkills,
      userMessage: "Analyze the current state and decide what action to take this cycle. Be concise.",
    });
  } catch (err) {
    log.error(`LLM call failed for ${agent.handle}`, { error: String(err) });
    return { success: false, error: `LLM error: ${String(err)}` };
  }

  // 4. PARSE ───────────────────────────────────────────────────────────
  // Record assistant message
  const assistantMsg: AgentMessage = {
    role: "assistant",
    content: llmResponse.content,
    toolCalls: llmResponse.toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
    timestamp: Date.now(),
  };
  context.messages.push(assistantMsg);

  // 5. EXECUTE TOOL CALLS ──────────────────────────────────────────────
  const results: { action: string; reasoning: string; blocked?: boolean; blockReason?: string }[] = [];

  for (const tc of llmResponse.toolCalls) {
    // 5a. CHECK POLICY ─────────────────────────────────────────────────
    const policy = checkPolicy(
      tc.name,
      tc.arguments,
      agent.commonRules,
      agent.specificRules,
      context.state.dailySpent,
    );

    let result: string;
    let status: AgentDecision["status"];

    if (!policy.allowed) {
      result = `BLOCKED: ${policy.reason}`;
      status = "blocked";
    } else {
      // 5b. EXECUTE ────────────────────────────────────────────────────
      const execution = executeToolCall(tc.name, tc.arguments, {
        solBalance: context.state.solBalance,
        usdcBalance: context.state.usdcBalance,
      });

      result = execution.result;
      status = "executed";

      // Apply state changes
      if (execution.stateChange) {
        context.state.solBalance += execution.stateChange.solBalance ?? 0;
        context.state.usdcBalance += execution.stateChange.usdcBalance ?? 0;

        // Track daily spend
        const spent = Math.abs(
          (execution.stateChange.usdcBalance ?? 0) +
          (execution.stateChange.solBalance ?? 0) * 130,
        );
        context.state.dailySpent += spent;
      }
    }

    // Record decision
    const decision: AgentDecision = {
      id: uuid(),
      action: tc.name,
      params: tc.arguments,
      reasoning: llmResponse.content ?? "No reasoning provided",
      status,
      blockReason: status === "blocked" ? policy.reason : undefined,
      timestamp: Date.now(),
    };
    context.decisions.push(decision);

    // Tool result message
    const toolMsg: AgentMessage = {
      role: "tool",
      content: result,
      toolCallId: tc.id,
      timestamp: Date.now(),
    };
    context.messages.push(toolMsg);

    results.push({
      action: tc.name,
      reasoning: llmResponse.content ?? "",
      blocked: status === "blocked",
      blockReason: policy.reason,
    });
  }

  // If no tool calls, treat content as decision
  if (llmResponse.toolCalls.length === 0 && llmResponse.content) {
    context.decisions.push({
      id: uuid(),
      action: "observe",
      params: {},
      reasoning: llmResponse.content,
      status: "executed",
      timestamp: Date.now(),
    });
    results.push({ action: "observe", reasoning: llmResponse.content });
  }

  // 6. UPDATE ──────────────────────────────────────────────────────────
  context.state.lastCycleAt = Date.now();
  context.updatedAt = Date.now();

  updateAgentState(agentId, {
    cycleCount: (agent.cycleCount ?? 0) + 1,
    lastActiveAt: Date.now(),
    totalTxCount: agent.totalTxCount + results.filter((r) => !r.blocked).length,
  });

  const mainResult = results[0];
  return {
    success: true,
    action: mainResult?.action,
    reasoning: mainResult?.reasoning,
    blocked: mainResult?.blocked,
    blockReason: mainResult?.blockReason,
  };
}

/** User chat from the app: runs one LLM turn with tools + policy, persists context. */
export async function runAgentChat(agentId: string, userText: string): Promise<{
  reply: string;
  error?: string;
}> {
  const trimmed = userText.trim();
  if (!trimmed) return { reply: "", error: "Empty message" };

  const agent = getAgent(agentId);
  if (!agent) return { reply: "", error: "Agent not found" };
  if (agent.status !== "active") {
    return { reply: "", error: `Agent is ${agent.status} — resume it to chat.` };
  }

  let context = getContext(agentId);
  if (!context) {
    const prompt = buildSystemPrompt(
      agent.strategyId,
      agent.commonRules,
      agent.specificRules,
      { solBalance: 0, usdcBalance: 0, dailySpent: 0 },
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
      dailySpent: context.state.dailySpent,
    },
  );

  if (context.messages[0]?.content !== systemPrompt) {
    context.messages[0] = { role: "system", content: systemPrompt, timestamp: Date.now() };
  }

  const userMsg: AgentMessage = { role: "user", content: trimmed, timestamp: Date.now() };
  addMessages(agentId, [userMsg]);
  context = getContext(agentId)!;

  const skills = getSkillsForStrategy(agent.strategyId);
  const enabledSkills = getEnabledSkills(skills);
  const historyForApi = context.messages.slice(1, -1);

  let llmResponse;
  try {
    llmResponse = await callLlm({
      systemPrompt: context.messages[0].content as string,
      messages: historyForApi,
      tools: enabledSkills,
      userMessage: trimmed,
    });
  } catch (err) {
    log.error(`Chat LLM failed for ${agent.handle}`, { error: String(err) });
    return { reply: "", error: `LLM error: ${String(err)}` };
  }

  const assistantMsg: AgentMessage = {
    role: "assistant",
    content: llmResponse.content,
    toolCalls: llmResponse.toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    })),
    timestamp: Date.now(),
  };
  context.messages.push(assistantMsg);

  const toolLines: string[] = [];

  for (const tc of llmResponse.toolCalls) {
    const policy = checkPolicy(
      tc.name,
      tc.arguments,
      agent.commonRules,
      agent.specificRules,
      context.state.dailySpent,
    );

    let result: string;
    let status: AgentDecision["status"];

    if (!policy.allowed) {
      result = `BLOCKED: ${policy.reason}`;
      status = "blocked";
    } else {
      const execution = executeToolCall(tc.name, tc.arguments, {
        solBalance: context.state.solBalance,
        usdcBalance: context.state.usdcBalance,
      });

      result = execution.result;
      status = "executed";

      if (execution.stateChange) {
        context.state.solBalance += execution.stateChange.solBalance ?? 0;
        context.state.usdcBalance += execution.stateChange.usdcBalance ?? 0;

        const spent = Math.abs(
          (execution.stateChange.usdcBalance ?? 0) +
            (execution.stateChange.solBalance ?? 0) * 130,
        );
        context.state.dailySpent += spent;
      }
    }

    const decision: AgentDecision = {
      id: uuid(),
      action: tc.name,
      params: tc.arguments,
      reasoning: llmResponse.content ?? "Chat tool call",
      status,
      blockReason: status === "blocked" ? policy.reason : undefined,
      timestamp: Date.now(),
    };
    context.decisions.push(decision);

    const toolMsg: AgentMessage = {
      role: "tool",
      content: result,
      toolCallId: tc.id,
      timestamp: Date.now(),
    };
    context.messages.push(toolMsg);

    const short = result.length > 700 ? `${result.slice(0, 700)}…` : result;
    toolLines.push(
      status === "blocked"
        ? `**${tc.name}** (blocked): ${policy.reason}`
        : `**${tc.name}**\n${short}`,
    );
  }

  if (llmResponse.toolCalls.length === 0 && llmResponse.content?.trim()) {
    context.decisions.push({
      id: uuid(),
      action: "chat_reply",
      params: {},
      reasoning: llmResponse.content,
      status: "executed",
      timestamp: Date.now(),
    });
  }

  context.updatedAt = Date.now();
  updateAgentState(agentId, { lastActiveAt: Date.now() });
  persistContexts();

  const reply =
    [llmResponse.content?.trim(), toolLines.length ? toolLines.join("\n\n") : ""]
      .filter(Boolean)
      .join("\n\n") ||
    (toolLines.length ? toolLines.join("\n\n") : "I processed your message.");

  return { reply };
}
