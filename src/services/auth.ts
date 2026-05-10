import nacl from "tweetnacl";
import bs58 from "bs58";
import { verifyToken, extractBearerToken } from "./jwt";
import { createLogger } from "../lib/logger";

const log = createLogger("auth");
const DEV_MODE = process.env.OISHI_DEV_MODE === "1";

// ── Types ───────────────────────────────────────────────────────────────
export interface AuthPayload {
  wallet: string;
  signature: string;
  message: string;
}

// ── Wallet signature verification ───────────────────────────────────────
export function verifyWalletSignature(payload: AuthPayload): boolean {
  if (DEV_MODE) return true;
  try {
    const publicKeyBytes = bs58.decode(payload.wallet);
    const signatureBytes = bs58.decode(payload.signature);
    const messageBytes = new TextEncoder().encode(payload.message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
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
export function requireAuth() {
  return async function authMiddleware(
    c: {
      req: { header: (n: string) => string | undefined };
      json: (body: unknown, status: number) => Response;
    },
    next: () => Promise<void>,
  ) {
    // 1. Try Bearer token first (persistent session)
    const authHeader = c.req.header("Authorization");
    const token = extractBearerToken(authHeader);

    if (token) {
      const payload = await verifyToken(token);
      if (payload) {
        (c as Record<string, unknown>).wallet = payload.wallet;
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

    if (!verifyWalletSignature(auth)) {
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

    (c as Record<string, unknown>).wallet = auth.wallet;
    await next();
  };
}
