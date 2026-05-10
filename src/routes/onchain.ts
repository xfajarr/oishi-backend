import { Hono } from "hono";
import { PublicKey } from "@solana/web3.js";
import { getAgent } from "../services/agent-store.js";
import { buildRegisterAgentTx, buildStrategyMask } from "../solana/registry.js";
import { requireAuth } from "../services/auth.js";
import type { OishiEnv } from "../types/hono-env.js";

export const onchainRouter = new Hono<OishiEnv>();

// ── POST /api/onchain/register-agent/:id ───────────────────────────────
// Builds a serialized Solana transaction for registering the agent on-chain.
// Frontend signs and sends it.
onchainRouter.post("/register-agent/:id", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
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

// ── POST /api/onchain/fund-agent/:id ──────────────────────────────────
// Builds a SOL transfer from user wallet to agent wallet.
onchainRouter.post("/fund-agent/:id", requireAuth(), async (c) => {
  const wallet = c.get("wallet");
  const id = c.req.param("id");
  const agent = getAgent(id);

  if (!agent) return c.json({ error: "Agent not found" }, 404);
  if (agent.owner !== wallet) return c.json({ error: "Not your agent" }, 403);

  const body = await c.req.json();
  const amountSol = parseFloat(body.amountSol);
  if (!amountSol || amountSol <= 0 || amountSol > 1000) {
    return c.json({ error: "Amount must be between 0.001 and 1000 SOL" }, 400);
  }

  try {
    const { Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
    const rpc = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
    const connection = new Connection(rpc, "confirmed");

    const from = new PublicKey(wallet);
    const to = new PublicKey(agent.walletPublicKey);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }),
    );
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.feePayer = from;

    return c.json({
      transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"),
      from: wallet,
      to: agent.walletPublicKey,
      amountSol,
      lamports,
      estimatedFee: "~0.000005 SOL",
    });
  } catch (err) {
    return c.json({ error: String(err) }, 500);
  }
});
