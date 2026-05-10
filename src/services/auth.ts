import nacl from "tweetnacl";
import bs58 from "bs58";

// ── Solana wallet signature verification ───────────────────────────────
const DEV_MODE = process.env.OISHI_DEV_MODE === "1";

export interface AuthPayload {
  wallet: string;
  signature: string;
  message: string;
}

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

export function extractAuth(headers: { get: (name: string) => string | undefined }): AuthPayload | null {
  const wallet = headers.get("x-oishi-wallet");
  const signature = headers.get("x-oishi-signature");
  const message = headers.get("x-oishi-message");

  if (DEV_MODE && wallet) {
    // In dev mode, only wallet header is required
    return { wallet, signature: "dev", message: JSON.stringify({ timestamp: Date.now() }) };
  }

  if (!wallet || !signature || !message) return null;
  return { wallet, signature, message };
}

export function requireAuth() {
  return async function authMiddleware(
    c: { req: { header: (n: string) => string | undefined }; json: (body: unknown, status: number) => Response },
    next: () => Promise<void>,
  ) {
    const headers = {
      get: (name: string) => c.req.header(name),
    };

    const auth = extractAuth(headers);

    if (!auth) {
      return c.json({ error: "Missing auth headers (x-oishi-wallet, x-oishi-signature, x-oishi-message)" }, 401);
    }

    if (!verifyWalletSignature(auth)) {
      return c.json({ error: "Invalid wallet signature" }, 401);
    }

    // Check timestamp is within 5 minutes (skip in dev mode)
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
