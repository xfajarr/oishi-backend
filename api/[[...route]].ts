/**
 * Vercel serverless entry — full app is pre-bundled to _bundle.mjs (see `bun run build`)
 * so Node never loads scattered `src/*.js` with broken ESM extension resolution.
 */
import { handle } from "@hono/node-server/vercel";
import type { Hono } from "hono";
// Built artifact from esbuild; not in git — no declaration file in CI before first build
// @ts-expect-error — _bundle.mjs is emitted by `bun run build` only
import app from "./_bundle.mjs";

export default handle(app as Hono);
