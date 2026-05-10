import { v4 as uuid } from "uuid";
import { getAgent, updateAgentState, updateAgentStatus } from "../services/agent-store";
import {
  getContext,
  initContext,
  addMessages,
  addDecision,
  updateState,
} from "../services/context-store";
import { getSkillsForStrategy } from "../models/skill";
import { callLlm, executeToolCall, getLlmModel } from "./client";
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
