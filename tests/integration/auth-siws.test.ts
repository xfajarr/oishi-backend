process.env.SIWS_DOMAIN = "test.oishi.local";
process.env.SIWS_URI = "https://test.oishi.local";
process.env.SIWS_ALLOWED_DOMAINS = "test.oishi.local";
process.env.JWT_SECRET = "test-secret-must-be-at-least-32-characters-long";
delete process.env.OISHI_DEV_MODE;

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";

import { authRouter } from "../../src/routes/auth.js";
import { _resetNonceStore } from "../../src/services/nonce-store.js";
import { makeKeypair, signSiws, tamperSignature } from "../helpers/siws.js";
import type { SiwsInput } from "../../src/services/siws.js";

function makeApp() {
  return new Hono().route("/api/auth", authRouter);
}

async function getChallenge(app: Hono, address: string): Promise<SiwsInput> {
  const res = await app.request("/api/auth/siws/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  assert.equal(res.status, 200, `challenge should return 200, got ${res.status}`);
  const body = (await res.json()) as { signInInput: SiwsInput };
  assert.ok(body.signInInput, "response must contain signInInput");
  return body.signInInput;
}

describe("POST /api/auth/siws/challenge", () => {
  beforeEach(() => _resetNonceStore());

  it("returns a signInInput bound to the requested address", async () => {
    const app = makeApp();
    const kp = await makeKeypair();
    const input = await getChallenge(app, kp.address);

    assert.equal(input.address, kp.address);
    assert.equal(input.domain, "test.oishi.local");
    assert.match(input.nonce, /^[A-Za-z0-9]{16,}$/);
  });

  it("400s when address is missing", async () => {
    const app = makeApp();
    const res = await app.request("/api/auth/siws/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(res.status, 400);
  });
});

describe("POST /api/auth/siws/verify", () => {
  beforeEach(() => _resetNonceStore());

  it("happy path: challenge → sign → verify returns a JWT, and /auth/me accepts it", async () => {
    const app = makeApp();
    const kp = await makeKeypair();
    const input = await getChallenge(app, kp.address);
    const output = await signSiws(input, kp);

    const res = await app.request("/api/auth/siws/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signInInput: input, signInOutput: output }),
    });
    assert.equal(res.status, 200);

    const body = (await res.json()) as { token: string; wallet: string };
    assert.equal(body.wallet, kp.address);
    assert.ok(body.token && body.token.split(".").length === 3, "token must be a JWT");

    const meRes = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${body.token}` },
    });
    assert.equal(meRes.status, 200);
    const me = (await meRes.json()) as { wallet: string };
    assert.equal(me.wallet, kp.address);
  });

  it("rejects a replayed verify (nonce already consumed)", async () => {
    const app = makeApp();
    const kp = await makeKeypair();
    const input = await getChallenge(app, kp.address);
    const output = await signSiws(input, kp);

    const ok = await app.request("/api/auth/siws/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signInInput: input, signInOutput: output }),
    });
    assert.equal(ok.status, 200);

    const replay = await app.request("/api/auth/siws/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signInInput: input, signInOutput: output }),
    });
    assert.equal(replay.status, 401);
  });

  it("rejects a tampered signature", async () => {
    const app = makeApp();
    const kp = await makeKeypair();
    const input = await getChallenge(app, kp.address);
    const output = tamperSignature(await signSiws(input, kp));

    const res = await app.request("/api/auth/siws/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signInInput: input, signInOutput: output }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects a wallet other than the one bound to the nonce", async () => {
    const app = makeApp();
    const kp = await makeKeypair();
    const intruder = await makeKeypair();

    const input = await getChallenge(app, kp.address);
    // Intruder swaps the address but keeps the legitimate nonce.
    const stolen: SiwsInput = { ...input, address: intruder.address };
    const output = await signSiws(stolen, intruder);

    const res = await app.request("/api/auth/siws/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signInInput: stolen, signInOutput: output }),
    });
    assert.equal(res.status, 401);
  });

  it("400s on a malformed body", async () => {
    const app = makeApp();
    const res = await app.request("/api/auth/siws/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signInInput: { nope: true } }),
    });
    assert.ok(res.status === 400 || res.status === 401, `got ${res.status}`);
  });
});
