/**
 * Vercel serverless entry — full app is pre-bundled to _bundle.mjs (see `bun run build`)
 * so Node never loads scattered `src/*.js` with broken ESM extension resolution.
 */
import { handle } from "@hono/node-server/vercel";
import app from "./_bundle.mjs";

export default handle(app);
