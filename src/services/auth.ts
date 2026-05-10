import * as ed from "@noble/ed25519";
import bs58 from "bs58";
import type { MiddlewareHandler } from "hono";
import { verifyToken, extractBearerToken } from "./jwt.js";
import { createLogger } from "../lib/logger.js";
import type { OishiEnv } from "../types/hono-env.js";

const log = createLogger("auth");
const DEV_MODE = process.env.OISHI_DEV_MODE === "1";

// ── Types ───────────────────────────────────────────────────────────────
export interface AuthPayload {
  wallet: string;
  signature: string;
  message: string;
}

// ── Wallet signature verification ───────────────────────────────────────
export async function verifyWalletSignature(payload: AuthPayload): Promise<boolean> {
  if (DEV_MODE) return true;
  try {
    const publicKeyBytes = bs58.decode(payload.wallet);
    const signatureBytes = bs58.decode(payload.signature);
    const messageBytes = new TextEncoder().encode(payload.message);
    return await ed.verifyAsync(signatureBytes, messageBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/** Extract raw wallet auth headers */
export function extractAuth(headers: { get: (name: string) => string | undefined }): AuthPayload | null {
  const wallet = headers.get("x-oishi-wallet");
  const signature = headers.get("x-oishi-signature");
  const message = headers.get("x-oishi-message");

  if (DEV_MODE && wallet) {
    return { wallet, signature: "dev", message: JSON.stringify({ timestamp: Date.now() }) };
  }

  if (!wallet || !signature || !message) return null;
  return { wallet, signature, message };
}

// ── Hono middleware — supports Bearer token OR wallet signature ──────────
export function requireAuth(): MiddlewareHandler<OishiEnv> {
  return async function authMiddleware(c, next) {
    // 1. Try Bearer token first (persistent session)
    const authHeader = c.req.header("Authorization");
    const token = extractBearerToken(authHeader);

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        c.set("wallet", payload.wallet);
        await next();
        return;
      }
      // Token invalid — continue to try wallet signature
    }

    // 2. Fall back to wallet signature (for login or legacy clients)
    const headers = {
      get: (name: string) => c.req.header(name),
    };

    const auth = extractAuth(headers);
    if (!auth) {
      if (token) {
        return c.json({ error: "Session expired. Please sign in again." }, 401);
      }
      return c.json(
        { error: "Authentication required. Provide Bearer token or wallet signature headers." },
        401,
      );
    }

    if (!await verifyWalletSignature(auth)) {
      return c.json({ error: "Invalid wallet signature" }, 401);
    }

    if (!DEV_MODE) {
      try {
        const parsed = JSON.parse(auth.message);
        const age = Date.now() - parsed.timestamp;
        if (age > 5 * 60 * 1000) {
          return c.json({ error: "Signature expired (>5 min old)" }, 401);
        }
      } catch {
        return c.json({ error: "Invalid auth message format" }, 401);
      }
    }

    c.set("wallet", auth.wallet);
    await next();
  };
}
