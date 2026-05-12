/**
 * Sign In With Solana (SIWS) — server side of the Phantom / wallet-standard protocol.
 * https://github.com/phantom/sign-in-with-solana
 */
import bs58 from "bs58";
import { createSignInMessage, verifySignIn } from "@solana/wallet-standard-util";
import type { SolanaSignInInputWithRequiredFields } from "@solana/wallet-standard-util";
import { createNonce, consumeNonce } from "./nonce-store.js";

export interface SiwsInput {
  domain: string;
  address: string;
  statement?: string;
  uri?: string;
  version?: string;
  chainId?: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export interface SiwsOutputWire {
  account: { publicKey: string }; // base58
  signedMessage: string;          // base64
  signature: string;              // base64
}

export type VerifyResult =
  | { ok: true; wallet: string }
  | { ok: false; reason: string };

const CHALLENGE_TTL_MS = 5 * 60_000;
const DEFAULT_STATEMENT =
  "Sign in to oishi. This won't trigger a transaction or cost any fees.";

function siwsDomain(): string {
  return process.env.SIWS_DOMAIN ?? "oishiapp.vercel.app";
}

function siwsUri(): string {
  return process.env.SIWS_URI ?? `https://${siwsDomain()}`;
}

function allowedDomains(): string[] {
  const raw = process.env.SIWS_ALLOWED_DOMAINS;
  if (raw) {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [siwsDomain()];
}

export function buildChallenge(address: string): SiwsInput {
  const nonce = createNonce(address, CHALLENGE_TTL_MS);
  const now = Date.now();
  return {
    domain: siwsDomain(),
    address,
    statement: DEFAULT_STATEMENT,
    uri: siwsUri(),
    version: "1",
    chainId: "mainnet",
    nonce,
    issuedAt: new Date(now).toISOString(),
    expirationTime: new Date(now + CHALLENGE_TTL_MS).toISOString(),
  };
}

export function buildMessageBytes(input: SiwsInput): Uint8Array {
  return createSignInMessage(input as SolanaSignInInputWithRequiredFields);
}

function safeBase64ToBytes(b64: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(b64, "base64"));
  } catch {
    return null;
  }
}

function safeBase58ToBytes(s: string): Uint8Array | null {
  try {
    return bs58.decode(s);
  } catch {
    return null;
  }
}

export async function verifyChallenge(
  input: SiwsInput,
  output: SiwsOutputWire,
): Promise<VerifyResult> {
  // 1. Domain allowlist.
  if (!allowedDomains().includes(input.domain)) {
    return { ok: false, reason: "domain not allowed" };
  }

  // 2. Expiry window.
  if (input.expirationTime && Date.parse(input.expirationTime) <= Date.now()) {
    return { ok: false, reason: "challenge expired" };
  }

  // 3. Nonce: single-use, bound to a specific wallet.
  const boundWallet = consumeNonce(input.nonce);
  if (!boundWallet) {
    return { ok: false, reason: "nonce invalid or already used" };
  }
  if (boundWallet !== input.address) {
    return { ok: false, reason: "nonce wallet mismatch" };
  }

  // 4. Decode wire output.
  const pubKeyBytes = safeBase58ToBytes(output.account.publicKey);
  const sigBytes = safeBase64ToBytes(output.signature);
  const msgBytes = safeBase64ToBytes(output.signedMessage);
  if (!pubKeyBytes || !sigBytes || !msgBytes) {
    return { ok: false, reason: "malformed output encoding" };
  }

  // 5. Public key must correspond to input.address.
  if (bs58.encode(pubKeyBytes) !== input.address) {
    return { ok: false, reason: "pubkey does not match address" };
  }

  // 6. Dev-mode bypass (matches existing services/auth.ts convention).
  if (process.env.OISHI_DEV_MODE === "1") {
    return { ok: true, wallet: input.address };
  }

  // 7. Cryptographic verification + message reconstruction.
  const ok = verifySignIn(input as SolanaSignInInputWithRequiredFields, {
    account: {
      address: input.address,
      publicKey: pubKeyBytes,
      chains: [],
      features: [],
    },
    signedMessage: msgBytes,
    signature: sigBytes,
  });
  if (!ok) return { ok: false, reason: "invalid signature" };

  return { ok: true, wallet: input.address };
}
