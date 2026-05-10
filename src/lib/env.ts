/**
 * Load .env file into process.env — no external dependencies.
 * Bun/tsx don't auto-load .env, so we do it manually.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ENV_PATH = join(import.meta.dirname, "..", "..", ".env");

try {
  const raw = readFileSync(ENV_PATH, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
} catch {
  // .env not found — use defaults
}
