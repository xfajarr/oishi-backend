import type { StrategyId } from "./agent";

// ── Skill (LLM-callable tool) ─────────────────────────────────────────
export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  /** OpenAI function-calling tool definition */
  toolDefinition: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
  /** Whether this skill is enabled for the agent */
  enabled: boolean;
}

// ── Skill sets per strategy ───────────────────────────────────────────
export function getSkillsForStrategy(strategyId: StrategyId): AgentSkill[] {
  const base = BASE_SKILLS;
  const specific = STRATEGY_SKILLS[strategyId] ?? [];
  return [...base, ...specific];
}

// ── Skills every agent gets ────────────────────────────────────────────
const BASE_SKILLS: AgentSkill[] = [
  {
    id: "check_balance",
    name: "Check Balance",
    description: "Get the current SOL and USDC balance of the agent wallet",
    toolDefinition: {
      type: "function",
      function: {
        name: "check_balance",
        description: "Get the current SOL and USDC balance of the agent wallet",
        parameters: { type: "object", properties: {}, required: [] },
      },
    },
    enabled: true,
  },
  {
    id: "wait",
    name: "Wait / Do Nothing",
    description: "Choose to take no action this cycle",
    toolDefinition: {
      type: "function",
      function: {
        name: "wait",
        description: "Take no action this cycle. Use when market conditions aren't favorable or you're waiting.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Why you chose to wait" },
          },
          required: ["reason"],
        },
      },
    },
    enabled: true,
  },
];

// ── Strategy-specific skills ───────────────────────────────────────────
const STRATEGY_SKILLS: Record<StrategyId, AgentSkill[]> = {
  kamino: [
    {
      id: "check_yield_vaults",
      name: "Check Yield Vaults",
      description: "Query Kamino yield vaults for current APY rates",
      toolDefinition: {
        type: "function",
        function: {
          name: "check_yield_vaults",
          description: "Query available Kamino yield vaults and their current APY rates",
          parameters: {
            type: "object",
            properties: {
              stableOnly: { type: "boolean", description: "If true, only return stablecoin vaults" },
            },
          },
        },
      },
      enabled: true,
    },
    {
      id: "deposit_to_kamino",
      name: "Deposit to Kamino",
      description: "Deposit funds into a Kamino yield vault",
      toolDefinition: {
        type: "function",
        function: {
          name: "deposit_to_kamino",
          description: "Deposit a specified amount of USDC into a Kamino yield vault",
          parameters: {
            type: "object",
            properties: {
              vault: { type: "string", description: "Vault identifier or name" },
              amount: { type: "number", description: "Amount in USDC to deposit" },
            },
            required: ["vault", "amount"],
          },
        },
      },
      enabled: true,
    },
    {
      id: "compound_rewards",
      name: "Compound Rewards",
      description: "Harvest and compound yield rewards",
      toolDefinition: {
        type: "function",
        function: {
          name: "compound_rewards",
          description: "Harvest pending rewards and re-deposit (compound) them",
          parameters: {
            type: "object",
            properties: {
              vault: { type: "string", description: "The vault to compound in" },
            },
            required: ["vault"],
          },
        },
      },
      enabled: true,
    },
  ],

  drift: [
    {
      id: "check_positions",
      name: "Check Positions",
      description: "List current open perp positions on Drift",
      toolDefinition: {
        type: "function",
        function: {
          name: "check_positions",
          description: "List current open perpetual positions on Drift protocol",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      enabled: true,
    },
    {
      id: "open_perp_trade",
      name: "Open Perp Trade",
      description: "Open a new perpetual futures position on Drift",
      toolDefinition: {
        type: "function",
        function: {
          name: "open_perp_trade",
          description: "Open a new perpetual futures position on Drift",
          parameters: {
            type: "object",
            properties: {
              market: { type: "string", description: "Market symbol (e.g. SOL-PERP)" },
              direction: { type: "string", enum: ["long", "short"] },
              size: { type: "number", description: "Position size in USD" },
              leverage: { type: "number", description: "Leverage multiplier (1-10)" },
            },
            required: ["market", "direction", "size", "leverage"],
          },
        },
      },
      enabled: true,
    },
    {
      id: "close_position",
      name: "Close Position",
      description: "Close an open perp position",
      toolDefinition: {
        type: "function",
        function: {
          name: "close_position",
          description: "Close an open perpetual position on Drift",
          parameters: {
            type: "object",
            properties: {
              market: { type: "string", description: "Market symbol to close" },
            },
            required: ["market"],
          },
        },
      },
      enabled: true,
    },
  ],

  polymarket: [
    {
      id: "search_markets",
      name: "Search Markets",
      description: "Search Polymarket prediction markets",
      toolDefinition: {
        type: "function",
        function: {
          name: "search_markets",
          description: "Search for active prediction markets on Polymarket",
          parameters: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              category: { type: "string", description: "Category filter (politics, crypto, sports, etc.)" },
            },
          },
        },
      },
      enabled: true,
    },
    {
      id: "place_bet",
      name: "Place Bet",
      description: "Place a bet on a Polymarket prediction market",
      toolDefinition: {
        type: "function",
        function: {
          name: "place_bet",
          description: "Place a bet on a Polymarket prediction market",
          parameters: {
            type: "object",
            properties: {
              marketId: { type: "string", description: "Market ID" },
              outcome: { type: "string", description: "Which outcome to bet on (Yes/No or specific)" },
              amount: { type: "number", description: "Bet amount in USDC" },
            },
            required: ["marketId", "outcome", "amount"],
          },
        },
      },
      enabled: true,
    },
  ],

  jupiter: [
    {
      id: "get_swap_quote",
      name: "Get Swap Quote",
      description: "Get a Jupiter swap quote for a token pair",
      toolDefinition: {
        type: "function",
        function: {
          name: "get_swap_quote",
          description: "Get the best swap route and price quote from Jupiter aggregator",
          parameters: {
            type: "object",
            properties: {
              inputToken: { type: "string", description: "Input token mint or symbol" },
              outputToken: { type: "string", description: "Output token mint or symbol" },
              amount: { type: "number", description: "Amount of input token to swap" },
            },
            required: ["inputToken", "outputToken", "amount"],
          },
        },
      },
      enabled: true,
    },
    {
      id: "execute_dca_buy",
      name: "Execute DCA Buy",
      description: "Execute a scheduled dollar-cost-average buy",
      toolDefinition: {
        type: "function",
        function: {
          name: "execute_dca_buy",
          description: "Execute a scheduled DCA (dollar-cost average) buy order on Jupiter",
          parameters: {
            type: "object",
            properties: {
              token: { type: "string", description: "Token to buy (e.g. SOL)" },
              amount: { type: "number", description: "USD amount to spend on this DCA buy" },
            },
            required: ["token", "amount"],
          },
        },
      },
      enabled: true,
    },
  ],

  meteora: [
    {
      id: "check_pools",
      name: "Check Pools",
      description: "Check Meteora DLMM pool status and ranges",
      toolDefinition: {
        type: "function",
        function: {
          name: "check_pools",
          description: "Check Meteora DLMM pool status, current price, and optimal ranges",
          parameters: {
            type: "object",
            properties: {
              tokenPair: { type: "string", description: "Token pair to check (e.g. SOL-USDC)" },
            },
          },
        },
      },
      enabled: true,
    },
    {
      id: "rebalance_lp",
      name: "Rebalance LP",
      description: "Rebalance LP position to optimal range",
      toolDefinition: {
        type: "function",
        function: {
          name: "rebalance_lp",
          description: "Rebalance a Meteora DLMM liquidity position to the current optimal price range",
          parameters: {
            type: "object",
            properties: {
              pool: { type: "string", description: "Pool identifier" },
            },
            required: ["pool"],
          },
        },
      },
      enabled: true,
    },
  ],

  sanctum: [
    {
      id: "check_lst_rates",
      name: "Check LST Rates",
      description: "Check liquid staking token rates on Sanctum",
      toolDefinition: {
        type: "function",
        function: {
          name: "check_lst_rates",
          description: "Check current liquid staking token APY rates on Sanctum",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      enabled: true,
    },
    {
      id: "stake_sol",
      name: "Stake SOL",
      description: "Stake SOL into a liquid staking token",
      toolDefinition: {
        type: "function",
        function: {
          name: "stake_sol",
          description: "Stake SOL into a liquid staking token on Sanctum",
          parameters: {
            type: "object",
            properties: {
              lstSymbol: { type: "string", description: "LST symbol (e.g. bonkSOL, jitoSOL)" },
              amount: { type: "number", description: "Amount of SOL to stake" },
            },
            required: ["lstSymbol", "amount"],
          },
        },
      },
      enabled: true,
    },
  ],

  raydium: [
    {
      id: "check_raydium_pools",
      name: "Check Raydium Pools",
      description: "Check Raydium AMM pool status and yields",
      toolDefinition: {
        type: "function",
        function: {
          name: "check_raydium_pools",
          description: "Check Raydium AMM/CLMM pool status, TVL, and current yields",
          parameters: {
            type: "object",
            properties: {
              tokenPair: { type: "string", description: "Token pair filter (optional)" },
            },
          },
        },
      },
      enabled: true,
    },
    {
      id: "provide_liquidity",
      name: "Provide Liquidity",
      description: "Provide liquidity to a Raydium pool",
      toolDefinition: {
        type: "function",
        function: {
          name: "provide_liquidity",
          description: "Provide liquidity to a Raydium pool",
          parameters: {
            type: "object",
            properties: {
              pool: { type: "string", description: "Pool address or identifier" },
              amount: { type: "number", description: "Amount in USD to provide" },
              concentrated: { type: "boolean", description: "Use concentrated liquidity range?" },
            },
            required: ["pool", "amount"],
          },
        },
      },
      enabled: true,
    },
  ],

  marginfi: [
    {
      id: "check_lending",
      name: "Check Lending Markets",
      description: "Check marginfi lending/borrowing rates",
      toolDefinition: {
        type: "function",
        function: {
          name: "check_lending",
          description: "Check marginfi lending and borrowing rates",
          parameters: { type: "object", properties: {}, required: [] },
        },
      },
      enabled: true,
    },
    {
      id: "supply_collateral",
      name: "Supply Collateral",
      description: "Supply collateral to marginfi for lending",
      toolDefinition: {
        type: "function",
        function: {
          name: "supply_collateral",
          description: "Supply collateral to marginfi",
          parameters: {
            type: "object",
            properties: {
              token: { type: "string", description: "Token to supply as collateral" },
              amount: { type: "number", description: "Amount to supply" },
            },
            required: ["token", "amount"],
          },
        },
      },
      enabled: true,
    },
  ],
};
