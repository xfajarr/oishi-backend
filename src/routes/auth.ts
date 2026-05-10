import { Hono } from "hono";
import { verifyWalletSignature, extractAuth } from "../services/auth.js";
import { signToken } from "../services/jwt.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("auth");

export const authRouter = new Hono();

// ── POST /api/auth/login ────────────────────────────────────────────────
// User signs a message once with their wallet → gets back a JWT.
// Body: { message: string, signature: string (base58) }
// Headers: x-oishi-wallet
authRouter.post("/login", async (c) => {
  const body = await c.req.json();
  const wallet = c.req.header("x-oishi-wallet");

  if (!wallet) {
    return c.json({ error: "Missing x-oishi-wallet header" }, 400);
  }

  const { message, signature } = body;
  if (!message || !signature) {
    return c.json({ error: "Missing message or signature in body" }, 400);
  }

  const auth = { wallet, signature, message };

  if (!await verifyWalletSignature(auth)) {
    return c.json({ error: "Invalid wallet signature" }, 401);
  }

  // Check timestamp freshness
  try {
    const parsed = JSON.parse(message);
    const age = Date.now() - parsed.timestamp;
    if (age > 5 * 60 * 1000) {
      return c.json({ error: "Signature expired (>5 min old)" }, 401);
    }
  } catch {
    return c.json({ error: "Invalid message format" }, 400);
  }

  const token = await signToken(wallet);

  log.info(`User authenticated: ${wallet.slice(0, 8)}...`);

  return c.json({
    token,
    wallet,
    expiresIn: process.env.JWT_EXPIRY ?? "7d",
  });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────
// Verify the current token is still valid.
authRouter.get("/me", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return c.json({ error: "No token" }, 401);

  const payload = await (await import("../services/jwt")).verifyToken(token);
  if (!payload) return c.json({ error: "Token invalid or expired" }, 401);

  return c.json({ wallet: payload.wallet, expiresAt: new Date(payload.exp * 1000).toISOString() });
});
