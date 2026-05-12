// Set SIWS env BEFORE importing the service (it reads env lazily but be defensive).
process.env.SIWS_DOMAIN = "test.oishi.local";
process.env.SIWS_URI = "https://test.oishi.local";
process.env.SIWS_ALLOWED_DOMAINS = "test.oishi.local";
delete process.env.OISHI_DEV_MODE;

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { buildChallenge, verifyChallenge, type SiwsInput } from "../../src/services/siws.js";
import { _resetNonceStore } from "../../src/services/nonce-store.js";
import { makeKeypair, signSiws, tamperSignature } from "../helpers/siws.js";

describe("siws.buildChallenge", () => {
  beforeEach(() => _resetNonceStore());

  it("returns a complete signInInput for the given address", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);

    assert.equal(input.address, kp.address);
    assert.equal(input.domain, "test.oishi.local");
    assert.equal(input.uri, "https://test.oishi.local");
    assert.match(input.nonce, /^[A-Za-z0-9]{16,}$/);
    assert.ok(input.issuedAt, "must set issuedAt");
    assert.ok(input.expirationTime, "must set expirationTime");

    // ISO-8601 parseable
    assert.ok(!Number.isNaN(Date.parse(input.issuedAt)));
    assert.ok(!Number.isNaN(Date.parse(input.expirationTime!)));

    // expirationTime ~ 5 min after issuedAt (allow 60s slack)
    const delta = Date.parse(input.expirationTime!) - Date.parse(input.issuedAt);
    assert.ok(delta >= 60_000, "expiration > 60s from issuedAt");
    assert.ok(delta <= 10 * 60_000, "expiration <= 10 min from issuedAt");
  });

  it("issues a unique nonce per call", async () => {
    const kp = await makeKeypair();
    const a = buildChallenge(kp.address);
    const b = buildChallenge(kp.address);
    assert.notEqual(a.nonce, b.nonce);
  });
});

describe("siws.verifyChallenge", () => {
  beforeEach(() => _resetNonceStore());

  it("accepts a freshly signed challenge and returns the wallet", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);
    const output = await signSiws(input, kp);

    const result = await verifyChallenge(input, output);
    assert.deepEqual(result, { ok: true, wallet: kp.address });
  });

  it("rejects a replayed nonce (single-use)", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);
    const output = await signSiws(input, kp);

    const first = await verifyChallenge(input, output);
    assert.equal(first.ok, true);

    const replay = await verifyChallenge(input, output);
    assert.equal(replay.ok, false);
    if (!replay.ok) assert.match(replay.reason, /nonce/i);
  });

  it("rejects an unknown nonce", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);
    const tampered: SiwsInput = { ...input, nonce: "deadbeefdeadbeef0000" };
    const output = await signSiws(tampered, kp);

    const result = await verifyChallenge(tampered, output);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /nonce/i);
  });

  it("rejects a domain outside the allowlist", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);
    const evil: SiwsInput = { ...input, domain: "evil.example.com" };
    const output = await signSiws(evil, kp);

    const result = await verifyChallenge(evil, output);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /domain/i);
  });

  it("rejects an expired challenge", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);
    const expired: SiwsInput = {
      ...input,
      issuedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
      expirationTime: new Date(Date.now() - 10 * 60_000).toISOString(),
    };
    const output = await signSiws(expired, kp);

    const result = await verifyChallenge(expired, output);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /expir/i);
  });

  it("rejects a tampered signature", async () => {
    const kp = await makeKeypair();
    const input = buildChallenge(kp.address);
    const output = tamperSignature(await signSiws(input, kp));

    const result = await verifyChallenge(input, output);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.reason, /signature/i);
  });

  it("rejects when output.publicKey does not match input.address", async () => {
    const kp = await makeKeypair();
    const intruder = await makeKeypair();
    const input = buildChallenge(kp.address);
    // Sign with intruder's key — public key in account won't match input.address.
    const output = await signSiws(input, intruder);

    const result = await verifyChallenge(input, output);
    assert.equal(result.ok, false);
  });
});
