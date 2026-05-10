/**
 * Vercel’s Hono build expects one of: src/index.ts, src/app.ts, src/server.ts, etc.
 * The real deployment uses `api/[[...route]].ts` + pre-bundled `api/_bundle.mjs` so Node ESM
 * never loads scattered `src/*.js` with broken relative imports. This file exists only to
 * satisfy the detector; the default export is the same Hono app as `main.ts`.
 */
export { default } from "./main.js";
