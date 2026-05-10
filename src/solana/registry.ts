/**
 * Builds transactions for the hoshi-agent-registry Solana program.
 * Transactions returned serialized — frontend signs and sends.
 */
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import idlJson from "./hoshi_agent_registry.json" with { type: "json" };
import { createHash } from "node:crypto";
import { createLogger } from "../lib/logger.js";

const log = createLogger("solana");

const PROGRAM_ID = new PublicKey(idlJson.address);
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

function getProgram() {
  const connection = new Connection(RPC, "confirmed");
  const wallet = {
    signTransaction: async () => { throw new Error("No wallet"); },
    signAllTransactions: async () => { throw new Error("No wallet"); },
    publicKey: PublicKey.default,
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // Anchor ≥0.30: Program(idl, provider) — program id comes from idl.address
  return new Program(idlJson as Idl, provider);
}

export function findAgentPda(handle: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), Buffer.from(handle)],
    PROGRAM_ID,
  );
  return pda;
}

const STRATEGY_BITS: Record<string, number> = {
  polymarket: 0, meteora: 1, kamino: 2, sanctum: 3,
  drift: 4, jupiter: 5, raydium: 6, marginfi: 7,
};

export function buildStrategyMask(strategyIds: string[]): number {
  let mask = 0;
  for (const id of strategyIds) mask |= 1 << (STRATEGY_BITS[id] ?? 99);
  return mask;
}

export function hashRules(rules: Record<string, unknown>): number[] {
  return Array.from(createHash("sha256").update(JSON.stringify(rules)).digest());
}

export async function buildRegisterAgentTx(params: {
  owner: PublicKey;
  handle: string;
  displayName: string;
  strategyMask: number;
  rules: Record<string, unknown>;
}): Promise<{ transaction: string; pda: string }> {
  const program = getProgram();
  const pda = findAgentPda(params.handle);
  const rulesHash = hashRules(params.rules);

  const tx = await program.methods
    .registerAgent(params.handle, params.displayName, params.strategyMask, rulesHash)
    .accounts({ owner: params.owner, agent: pda, systemProgram: SystemProgram.programId })
    .transaction();

  const connection = new Connection(RPC, "confirmed");
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = params.owner;

  log.info(`Built register_agent tx`, { handle: params.handle, pda: pda.toBase58() });
  return { transaction: tx.serialize({ requireAllSignatures: false }).toString("base64"), pda: pda.toBase58() };
}

export { PROGRAM_ID };
