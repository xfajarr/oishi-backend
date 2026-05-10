/**
 * Builds transactions for the hoshi-agent-registry Solana program.
 * Transactions are returned serialized — frontend signs and sends.
 */
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import IDL from "./hoshi_agent_registry.json";
import { createLogger } from "../lib/logger";
import { createHash } from "node:crypto";

const log = createLogger("solana");

const PROGRAM_ID = new PublicKey("EdsJZDNVQ2ncXrXaTFd2aZFhrYqLBJGJBq6xAY26PR9a");
const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

// ── Anchor program instance (read-only, used for instruction building) ──
function getProgram() {
  const connection = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(connection, {} as any, { commitment: "confirmed" });
  return new Program(IDL as Idl, PROGRAM_ID, provider);
}

// ── PDA derivation (mirrors the Rust program) ──────────────────────────
export function findAgentPda(handle: string): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), Buffer.from(handle)],
    PROGRAM_ID,
  );
  return pda;
}

// ── Strategy bitmask builder ──────────────────────────────────────────
const STRATEGY_BITS: Record<string, number> = {
  polymarket: 0, meteora: 1, kamino: 2, sanctum: 3,
  drift: 4, jupiter: 5, raydium: 6, marginfi: 7,
};

export function buildStrategyMask(strategyIds: string[]): number {
  let mask = 0;
  for (const id of strategyIds) {
    const bit = STRATEGY_BITS[id];
    if (bit !== undefined) mask |= 1 << bit;
  }
  return mask;
}

// ── Rules hash (SHA256 of JSON) ───────────────────────────────────────
export function hashRules(rules: Record<string, unknown>): number[] {
  const json = JSON.stringify(rules);
  const hash = createHash("sha256").update(json).digest();
  return Array.from(hash);
}

// ── Build register_agent transaction ───────────────────────────────────
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
    .accounts({
      owner: params.owner,
      agent: pda,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  // Set recent blockhash
  const connection = new Connection(RPC, "confirmed");
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = params.owner;

  const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");

  log.info(`Built register_agent tx`, { handle: params.handle, pda: pda.toBase58() });

  return { transaction: serialized, pda: pda.toBase58() };
}

// ── Build set_agent_status transaction ─────────────────────────────────
export async function buildSetStatusTx(params: {
  owner: PublicKey;
  handle: string;
  status: number; // 0=active, 1=paused, 2=stopped
}): Promise<{ transaction: string }> {
  const program = getProgram();
  const pda = findAgentPda(params.handle);

  const tx = await program.methods
    .setAgentStatus({ active: {}, paused: {}, stopped: {}, blocked: {} }[["active","paused","stopped","blocked"][params.status]] ?? { paused: {} })
    .accounts({
      owner: params.owner,
      agent: pda,
    })
    .transaction();

  const connection = new Connection(RPC, "confirmed");
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.feePayer = params.owner;

  return { transaction: tx.serialize({ requireAllSignatures: false }).toString("base64") };
}

export { PROGRAM_ID };
