/**
 * Vercel’s Hono build expects `src/index.ts` (or src/app.ts, …) and rejects it unless this
 * file contains a value import from `"hono"`. Production traffic uses `api/[[...route]].ts`
 * + the esbuild output `api/_bundle.mjs` (see `main.ts`).
 */
import { Hono } from "hono";

export { default } from "./main.js";

void Hono;
