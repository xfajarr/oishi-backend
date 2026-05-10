/**
 * JWT session token signing/verification using jose.
 * User signs wallet once → gets a JWT → uses Bearer token for all subsequent calls.
 */
import { SignJWT, jwtVerify } from "jose";
import { createLogger } from "../lib/logger.js";

const log = createLogger("jwt");

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "oishi-dev-secret-change-in-production-min-32-chars",
);

const TOKEN_EXPIRY = process.env.JWT_EXPIRY ?? "7d";

export interface JwtPayload {
  wallet: string;
  iat: number;
  exp: number;
}

/**
 * Sign a JWT for a wallet address.
 */
export async function signToken(wallet: string): Promise<string> {
  const token = await new SignJWT({ wallet })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET);

  log.debug(`Token issued for ${wallet.slice(0, 8)}...`, { expiry: TOKEN_EXPIRY });
  return token;
}

/**
 * Verify a JWT and extract the wallet address.
 * Returns null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.wallet || typeof payload.wallet !== "string") return null;
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
