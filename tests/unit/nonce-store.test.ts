import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createNonce, consumeNonce, _resetNonceStore } from "../../src/services/nonce-store.js";

describe("nonce-store", () => {
  beforeEach(() => {
    _resetNonceStore();
  });

  it("issues an alphanumeric nonce of at least 16 chars", () => {
    const nonce = createNonce("WaLLetAddr1");
    assert.match(nonce, /^[A-Za-z0-9]{16,}$/);
  });

  it("issues unique nonces on each call", () => {
    const a = createNonce("w1");
    const b = createNonce("w1");
    assert.notEqual(a, b);
  });

  it("consume returns the bound wallet exactly once (single-use)", () => {
    const nonce = createNonce("WALLET_A");
    assert.equal(consumeNonce(nonce), "WALLET_A");
    assert.equal(consumeNonce(nonce), null, "replay must return null");
  });

  it("consume returns null for unknown nonces", () => {
    assert.equal(consumeNonce("never-issued"), null);
  });

  it("consume returns null after TTL expires", () => {
    mock.timers.enable({ apis: ["Date"], now: 0 });
    try {
      const nonce = createNonce("WALLET_B", 60_000); // 60s TTL
      mock.timers.tick(61_000);
      assert.equal(consumeNonce(nonce), null);
    } finally {
      mock.timers.reset();
    }
  });

  it("default TTL is at least 60s and at most 10 minutes", () => {
    mock.timers.enable({ apis: ["Date"], now: 0 });
    try {
      const nonce = createNonce("WALLET_C");
      mock.timers.tick(59_000);
      assert.equal(consumeNonce(nonce), "WALLET_C", "must survive 59s");
    } finally {
      mock.timers.reset();
    }

    mock.timers.enable({ apis: ["Date"], now: 0 });
    try {
      const nonce = createNonce("WALLET_D");
      mock.timers.tick(10 * 60_000 + 1_000); // 10 min + 1s
      assert.equal(consumeNonce(nonce), null, "must expire by 10 min");
    } finally {
      mock.timers.reset();
    }
  });
});
