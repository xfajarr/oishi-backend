import { Hono } from "hono";
import { PublicKey } from "@solana/web3.js";
import { getAgent } from "../services/agent-store";
import { buildRegisterAgentTx, buildStrategyMask } from "../solana/registry";
import { requireAuth } from "../services/auth";

export const onchainRouter = new Hono();

// ── POST /api/onchain/register-agent/:id ───────────────────────────────
// Builds a serialized Solana transaction for registering the agent on-chain.
// Frontend signs and sends it.
onchainRouter.post("/register-agent/:id", requireAuth(), async (c) => {
  const wallet = (c as Record<string, unknown>).wallet as string;
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  try {
    const owner = new PublicKey(wallet);
    const strategyMask = buildStrategyMask([agent.strategyId]);

    const { transaction, pda } = await buildRegisterAgentTx({
      owner,
      handle: agent.handle.replace("@", ""), // strip @ for PDA seed
      displayName: agent.displayName,
      strategyMask,
      rules: { common: agent.commonRules, specific: agent.specificRules },
    });

    return c.json({
      transaction,
      pda,
      handle: agent.handle,
      programId: "EdsJZDNVQ2ncXrXaTFd2aZFhrYqLBJGJBq6xAY26PR9a",
      instructions: "Frontend: deserialize tx → sign with wallet → send to Solana devnet",
      estimatedFee: "~0.003 SOL",
    });
  } catch (err) {
    return c.json({ error: `Failed to build transaction: ${String(err)}` }, 500);
  }
});
