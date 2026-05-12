import { z } from "zod";

// ── Soul: the agent's personality & character ──────────────────────────
// Shaped by the owner at launch time. Used to build the system prompt.

export const SoulTraitsSchema = z.object({
  /** Core disposition: how the agent approaches decisions */
  disposition: z.enum(["cautious", "balanced", "bold"]).default("balanced"),
  /** Communication verbosity: terse / concise / detailed / verbose */
  verbosity: z.enum(["terse", "concise", "detailed", "verbose"]).default("concise"),
  /** Emotional tone: neutral / optimistic / pessimistic / playful */
  tone: z.enum(["neutral", "optimistic", "pessimistic", "playful"]).default("neutral"),
  /** Reasoning style: fast / deliberate / thorough */
  reasoning: z.enum(["fast", "deliberate", "thorough"]).default("deliberate"),
  /** Risk appetite multiplier (0.5 = very conservative, 1.0 = normal, 1.5 = aggressive) */
  riskAppetite: z.number().min(0.5).max(1.5).default(1.0),
  /** Primary focus: yield / growth / safety / speculation */
  focus: z.enum(["yield", "growth", "safety", "speculation"]).default("yield"),
});

export type SoulTraits = z.infer<typeof SoulTraitsSchema>;

export const defaultSoulTraits: SoulTraits = {
  disposition: "balanced",
  verbosity: "concise",
  tone: "neutral",
  reasoning: "deliberate",
  riskAppetite: 1.0,
  focus: "yield",
};

// ── Soul record ──────────────────────────────────────────────────────────
export interface AgentSoul {
  agentId: string;
  /** Owner-written backstory — injected into system prompt */
  backstory: string;
  /** Freeform goals — what the agent is trying to achieve */
  goals: string;
  /** Things the agent should avoid */
  boundaries: string;
  /** How the agent refers to itself */
  selfName: string;
  /** Avatar seed — hex color or image URL */
  avatarSeed: string;
  /** Personality traits */
  traits: SoulTraits;
  /** Communication style preferences */
  communicationStyle: {
    useEmoji: boolean;
    useSlang: boolean;
    language: "en" | "mixed";
  };
  createdAt: number;
  updatedAt: number;
}

export const defaultSoul: Omit<AgentSoul, "agentId" | "createdAt" | "updatedAt"> = {
  backstory: "",
  goals: "",
  boundaries: "",
  selfName: "I",
  avatarSeed: "#6366F1",
  traits: defaultSoulTraits,
  communicationStyle: {
    useEmoji: false,
    useSlang: false,
    language: "en",
  },
};

// ── Build soul system-prompt segment ───────────────────────────────────
export function buildSoulPromptSegment(soul: AgentSoul, strategyName: string): string {
  const { traits, backstory, goals, boundaries, selfName, communicationStyle } = soul;

  const dispositionMap = {
    cautious: "You are highly cautious. Only act when conditions are clearly favorable. Prefer doing nothing over acting impulsively.",
    balanced: "You balance risk and reward. Act when the opportunity justifies the risk, but never bet everything on one outcome.",
    bold: "You are willing to take calculated risks for better returns. Look for asymmetric opportunities.",
  };

  const verbosityMap = {
    terse: "Keep responses extremely short — 1-3 sentences maximum. No elaboration.",
    concise: "Be concise but informative. 1-2 paragraphs. Stick to the point.",
    detailed: "Provide thorough explanations with context. Cover the what, why, and how.",
    verbose: "Be comprehensive. Explain everything in depth. Leave no question unanswered.",
  };

  const toneMap = {
    neutral: "",
    optimistic: "You tend toward optimism, highlighting opportunities and positive outcomes while remaining honest about risks.",
    pessimistic: "You are conservative in your outlook, always considering what could go wrong before acting.",
    playful: "You have a light, engaging tone. Use wit and humor where appropriate without being unprofessional.",
  };

  const reasoningMap = {
    fast: "Think quickly and decisively. Don't overthink — trust your training.",
    deliberate: "Think step by step, weighing pros and cons before deciding.",
    thorough: "Think deeply and exhaustively. Consider edge cases, second-order effects, and long-term consequences.",
  };

  const emojiNote = communicationStyle.useEmoji
    ? "You may use relevant emoji to add personality where appropriate."
    : "Avoid emoji — keep communication text-only.";

  const slangNote = communicationStyle.useSlang
    ? "You may use casual language and slang to feel more conversational."
    : "Use professional, clear language.";

  const parts = [
    `## Your Character (Soul)`,
    selfName !== "I"
      ? `You refer to yourself as "${selfName}" in the first person.`
      : null,
    backstory
      ? `## Your Background\n${backstory}`
      : null,
    goals
      ? `## Your Goals\n${goals}`
      : null,
    boundaries
      ? `## Boundaries (never cross these)\n${boundaries}`
      : null,
    `## Your Personality`,
    dispositionMap[traits.disposition],
    verbosityMap[traits.verbosity],
    toneMap[traits.tone],
    reasoningMap[traits.reasoning],
    emojiNote,
    slangNote,
    `## Risk Appetite: ${traits.riskAppetite}x`,
    traits.focus !== "yield"
      ? `Your primary focus is: **${traits.focus}**`
      : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}
