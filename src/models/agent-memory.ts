import { z } from "zod";

// ── Memory entries: persistent facts the agent learns over time ──────────
// Unlike messages (conversation history), memory entries are distilled
// facts the agent has internalized from interactions + tool calls.

export const MemoryTagSchema = z.enum([
  "fact",        // verifiable fact
  "preference",  // owner preference
  "lesson",      // learned from a mistake
  "milestone",   // achievement or event
  "context",     // situational context
  "relationship", // how the agent views something
]);

export type MemoryTag = z.infer<typeof MemoryTagSchema>;

// ── Individual memory entry ─────────────────────────────────────────────
export interface MemoryEntry {
  id: string;
  agentId: string;
  /** The distilled fact/preference/lesson as a natural-language string */
  content: string;
  /** Semantic tags for retrieval */
  tags: MemoryTag[];
  /** Importance: 1-10. Higher = more resistant to forgetting */
  importance: number;
  /** How many times this memory has been "recalled" (referenced in reasoning) */
  recallCount: number;
  /** Last time this entry was used in a reasoning cycle */
  lastRecalledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// ── Session: a continuous interaction period ───────────────────────────
export interface Session {
  id: string;
  agentId: string;
  /** Human-readable label: "Morning check-in", "Rebalancing session", etc. */
  label: string;
  /** Who initiated: "owner" | "scheduler" | "agent" */
  initiator: "owner" | "scheduler" | "agent";
  startedAt: number;
  endedAt: number | null; // null = still active
  /** Number of LLM turns in this session */
  turnCount: number;
  /** Key outcome of the session */
  summary: string;
  /** Whether the session ended in an error */
  hadError: boolean;
}

// ── Session history for an agent ────────────────────────────────────────
export interface SessionHistory {
  agentId: string;
  sessions: Session[];
  /** ID of the currently active session (null if none) */
  activeSessionId: string | null;
  /** Total sessions ever created */
  totalSessions: number;
}

// ── Chat message with memory context ───────────────────────────────────
export interface MemoryAugmentedMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    result?: string;
  }[];
  toolCallId?: string;
  timestamp: number;
  /** Memories retrieved for this turn */
  memoriesRetrieved?: string[];
}

// ── Default empty memory state ─────────────────────────────────────────
export function createEmptyMemoryState(agentId: string): MemoryState {
  return {
    agentId,
    entries: [],
    activeSessionId: null,
    sessions: [],
    totalSessions: 0,
  };
}

// ── Memory state ───────────────────────────────────────────────────────
export interface MemoryState {
  agentId: string;
  entries: MemoryEntry[];
  sessions: Session[];
  activeSessionId: string | null;
  totalSessions: number;
}

// ── Memory retrieval: find relevant entries for a query ────────────────
// Simple keyword + tag matching (no vector DB needed for MVP).
// Returns top `limit` entries sorted by relevance score.

export function retrieveMemories(
  state: MemoryState,
  query: string,
  limit = 5,
): MemoryEntry[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  const scored = state.entries.map((entry) => {
    let score = 0;

    // Importance bonus
    score += entry.importance * 2;

    // Recency bonus (decays over 30 days)
    const ageMs = Date.now() - entry.updatedAt;
    const recencyBonus = Math.max(0, 1 - ageMs / (30 * 24 * 60 * 60 * 1000));
    score += recencyBonus * 3;

    // Keyword match in content
    for (const word of queryWords) {
      if (entry.content.toLowerCase().includes(word)) {
        score += 2;
      }
    }

    // Tag match
    for (const word of queryWords) {
      if (entry.tags.some((tag) => tag.includes(word))) {
        score += 1;
      }
    }

    // Penalty for recently recalled (encourage diversity)
    if (entry.lastRecalledAt) {
      const timeSinceRecall = Date.now() - entry.lastRecalledAt;
      if (timeSinceRecall < 60 * 60 * 1000) {
        // recalled within 1 hour
        score -= 1;
      }
    }

    return { entry, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

// ── Build memory context for LLM ───────────────────────────────────────
export function buildMemoryContext(
  state: MemoryState,
  recentMessages: string[],
  limit = 5,
): string {
  if (state.entries.length === 0) {
    return "You have no persistent memories yet.";
  }

  // Combine recent messages for context
  const query = recentMessages.join(" ");
  const relevant = retrieveMemories(state, query, limit);

  if (relevant.length === 0) {
    return "You have no memories directly relevant to this situation.";
  }

  // Mark as recalled
  for (const entry of relevant) {
    entry.recallCount++;
    entry.lastRecalledAt = Date.now();
  }

  const lines = relevant.map(
    (e) => `• [${e.tags.join(", ")}] ${e.content}`,
  );

  return [
    "## Relevant Memories",
    ...lines,
    "",
    `(${relevant.length} of ${state.entries.length} total memories)`,
  ].join("\n");
}
