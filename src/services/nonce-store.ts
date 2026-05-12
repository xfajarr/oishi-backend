/**
 * Single-use, TTL'd nonce store for SIWS challenges.
 * In-memory map keyed by nonce → { wallet, expiresAt }.
 */
import { randomBytes } from "node:crypto";

export interface NonceRecord {
  wallet: string;
  expiresAt: number;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const DEFAULT_TTL_MS = 5 * 60_000;
const NONCE_LEN = 16;

const store = new Map<string, NonceRecord>();

function randomNonce(): string {
  const bytes = randomBytes(NONCE_LEN);
  let out = "";
  for (let i = 0; i < NONCE_LEN; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

export function createNonce(wallet: string, ttlMs: number = DEFAULT_TTL_MS): string {
  let nonce: string;
  do {
    nonce = randomNonce();
  } while (store.has(nonce));
  store.set(nonce, { wallet, expiresAt: Date.now() + ttlMs });
  return nonce;
}

export function consumeNonce(nonce: string): string | null {
  const record = store.get(nonce);
  if (!record) return null;
  store.delete(nonce);
  if (record.expiresAt <= Date.now()) return null;
  return record.wallet;
}

export function _resetNonceStore(): void {
  store.clear();
}
