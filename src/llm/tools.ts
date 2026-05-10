import type { AgentSkill } from "../models/skill";
import type { CommonRules, SpecificRules } from "../models/agent";

// ── Policy enforcement: check if an agent action is within rules ───────
export interface PolicyCheck {
  allowed: boolean;
  reason?: string;
}

export function checkPolicy(
  toolName: string,
  args: Record<string, unknown>,
  common: CommonRules,
  _specific: SpecificRules,
  dailySpent: number,
): PolicyCheck {
  // Spend actions: deposit, bet, buy, stake, supply
  const spendActions = ["deposit_to_kamino", "place_bet", "execute_dca_buy", "stake_sol", "provide_liquidity", "supply_collateral", "open_perp_trade"];
  const amount = Number(args.amount ?? args.size ?? 0);

  if (spendActions.includes(toolName) && amount > 0) {
    // Check per-transaction limit
    if (amount > common.maxPerTxUsd) {
      return {
        allowed: false,
        reason: `Amount $${amount} exceeds max per-transaction limit of $${common.maxPerTxUsd}`,
      };
    }

    // Check daily limit
    if (dailySpent + amount > common.dailyCapUsd) {
      return {
        allowed: false,
        reason: `Would spend $${(dailySpent + amount).toFixed(2)} today, exceeding daily cap of $${common.dailyCapUsd} (already spent $${dailySpent.toFixed(2)})`,
      };
    }

    return { allowed: true };
  }

  // Leverage check for drift
  if (toolName === "open_perp_trade" && args.leverage) {
    const lev = Number(args.leverage);
    if (lev > 10) {
      return { allowed: false, reason: `Leverage ${lev}x exceeds maximum 10x` };
    }
  }

  // Read-only actions always allowed
  return { allowed: true };
}

// ── Get enabled skills for an agent's current cycle ────────────────────
export function getEnabledSkills(skills: AgentSkill[]): AgentSkill[] {
  return skills.filter((s) => s.enabled);
}
