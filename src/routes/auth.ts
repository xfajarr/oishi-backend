import { Hono } from "hono";
import { verifyWalletSignature, extractAuth } from "../services/auth.js";
import { signToken } from "../services/jwt.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("auth");

export const authRouter = new Hono();

/**
 * Create a SIWS (Sign-In With Solana) message for the user to sign.
 * Follows the EIP-4361 / SIWE-style format adapted for Solana.
 */
function createSiwsMessage(address: string, nonce: string, issuedAt: string): string {
  return `oishi.app wants you to sign in with your Solana account:
${address}

Sign in to Oishi to manage your AI agents.

URI: https://oishi.app
Version: 1
Chain ID: 101
Nonce: ${nonce}
Issued At: ${issuedAt}
Expiration Time: ${new Date(Date.now() + 5 * 60 * 1000).toISOString()}`;
}

// ── GET /api/auth/siws-message ───────────────────────────────────────────
// Returns a SIWS message for the user to sign.
authRouter.get("/siws-message", async (c) => {
  const wallet = c.req.header("x-oishi-wallet");
  if (!wallet) return c.json({ error: "Missing x-oishi-wallet header" }, 400);

  const nonce = Math.random().toString(36).substring(2, 15);
  const issuedAt = new Date().toISOString();
  const message = createSiwsMessage(wallet, nonce, issuedAt);

  return c.json({ message, nonce, issuedAt });
});

// ── POST /api/auth/login ────────────────────────────────────────────────
// User signs a SIWS message with their wallet → returns JWT.
authRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const wallet = c.req.header("x-oishi-wallet");

  if (!wallet) return c.json({ error: "Missing x-oishi-wallet header" }, 400);
  const { message, signature } = body;
  if (!message || !signature) return c.json({ error: "Missing message or signature" }, 400);

  // Verify the message contains the wallet address
  if (!message.includes(wallet)) return c.json({ error: "Message does not match wallet" }, 400);

  const auth = { wallet, signature, message };
  if (!await verifyWalletSignature(auth)) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  const token = await signToken(wallet);
  log.info(`User authenticated: ${wallet.slice(0, 8)}...`);

  return c.json({ token, wallet, expiresIn: process.env.JWT_EXPIRY ?? "7d" });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────
authRouter.get("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "No token" }, 401);

  const payload = await (await import("../services/jwt")).verifyToken(token);
  if (!payload) return c.json({ error: "Token invalid or expired" }, 401);

  return c.json({ wallet: payload.wallet, expiresAt: new Date(payload.exp * 1000).toISOString() });
});
