import nacl from "tweetnacl";
import bs58 from "bs58";

// ── Solana wallet signature verification ───────────────────────────────
// The frontend signs: JSON.stringify({ path, method, timestamp, body })
// The wallet adapter's signMessage returns a Uint8Array signature.

export interface AuthPayload {
  wallet: string; // base58 pubkey
  signature: string; // base58 signature
  message: string; // the original message that was signed
}

export function verifyWalletSignature(payload: AuthPayload): boolean {
  try {
    const publicKeyBytes = bs58.decode(payload.wallet);
    const signatureBytes = bs58.decode(payload.signature);
    const messageBytes = new TextEncoder().encode(payload.message);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/** Extract auth headers from a request */
export function extractAuth(headers: Headers): AuthPayload | null {
  const wallet = headers.get("x-oishi-wallet");
  const signature = headers.get("x-oishi-signature");
  const message = headers.get("x-oishi-message");

  if (!wallet || !signature || !message) return null;
  return { wallet, signature, message };
}

/** Hono middleware: require valid wallet signature */
export function requireAuth() {
  return async function authMiddleware(c: { req: { header: (n: string) => string | undefined }; json: (body: unknown, status: number) => Response }, next: () => Promise<void>) {
    const auth = extractAuth({
      get: (name: string) => c.req.header(name),
    } as Headers);

    if (!auth) {
      return c.json({ error: "Missing auth headers (x-oishi-wallet, x-oishi-signature, x-oishi-message)" }, 401);
    }

    if (!verifyWalletSignature(auth)) {
      return c.json({ error: "Invalid wallet signature" }, 401);
    }

    // Check timestamp is within 5 minutes to prevent replay
    try {
      const parsed = JSON.parse(auth.message);
      const age = Date.now() - parsed.timestamp;
      if (age > 5 * 60 * 1000) {
        return c.json({ error: "Signature expired (>5 min old)" }, 401);
      }
    } catch {
      return c.json({ error: "Invalid auth message format" }, 401);
    }

    // Attach wallet to context for downstream handlers
    (c as Record<string, unknown>).wallet = auth.wallet;
    await next();
  };
}
