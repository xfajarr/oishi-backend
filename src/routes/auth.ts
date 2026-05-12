import { Hono } from "hono";
import { verifyWalletSignature, extractAuth } from "../services/auth.js";
import { signToken } from "../services/jwt.js";
import { buildChallenge, verifyChallenge, type SiwsInput, type SiwsOutputWire } from "../services/siws.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("auth");

export const authRouter = new Hono();

function isSiwsInput(v: unknown): v is SiwsInput {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.domain === "string"
    && typeof r.address === "string"
    && typeof r.nonce === "string"
    && typeof r.issuedAt === "string";
}

function isSiwsOutput(v: unknown): v is SiwsOutputWire {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  const acc = r.account as Record<string, unknown> | undefined;
  return typeof r.signedMessage === "string"
    && typeof r.signature === "string"
    && !!acc
    && typeof acc.publicKey === "string";
}

// ── POST /api/auth/siws/challenge ───────────────────────────────────────
// Body: { address: string }  →  { signInInput }
authRouter.post("/siws/challenge", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const address = (body as { address?: unknown } | null)?.address;
  if (typeof address !== "string" || !address) {
    return c.json({ error: "Missing 'address' in body" }, 400);
  }
  const signInInput = buildChallenge(address);
  return c.json({ signInInput });
});

// ── POST /api/auth/siws/verify ──────────────────────────────────────────
// Body: { signInInput, signInOutput }  →  { token, wallet, expiresIn }
authRouter.post("/siws/verify", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
  const { signInInput, signInOutput } = (body ?? {}) as {
    signInInput?: unknown;
    signInOutput?: unknown;
  };
  if (!isSiwsInput(signInInput) || !isSiwsOutput(signInOutput)) {
    return c.json({ error: "Malformed signInInput or signInOutput" }, 400);
  }

  const result = await verifyChallenge(signInInput, signInOutput);
  if (!result.ok) {
    log.warn(`SIWS verify failed: ${result.reason}`);
    return c.json({ error: "SIWS verification failed" }, 401);
  }

  const token = await signToken(result.wallet);
  log.info(`SIWS auth: ${result.wallet.slice(0, 8)}...`);

  return c.json({
    token,
    wallet: result.wallet,
    expiresIn: process.env.JWT_EXPIRY ?? "7d",
  });
});

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
