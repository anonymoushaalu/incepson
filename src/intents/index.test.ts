import { describe, it, expect, beforeEach, vi } from "vitest";

vi.stubEnv("DEVICE_HMAC_SECRET", "test-secret-do-not-use-in-prod");
vi.stubEnv("DB_PATH", ":memory:");

const { canonicalize, sign, verifyHmac, createIntent, approveIntent, getPendingIntent } = await import("./index.js");
const { db } = await import("../db.js");

const now = new Date("2026-09-12T00:00:00.000Z");

// intents.request_id has a foreign key into payment_requests; fixtures need
// a real row there, not just a string id.
let requestCounter = 0;
function seedRequest(): string {
  const id = `req-${++requestCounter}`;
  db.prepare(
    `INSERT INTO payment_requests (id, created_at, service, amount_hbar, reason, decision, decision_code, signals_json, settled)
     VALUES (?, ?, 'gas-oracle.local', 0.08, 'test', 'ESCALATE', 'AMOUNT_ANOMALOUS', '{}', 0)`
  ).run(id, now.toISOString());
  return id;
}

describe("intents: canonicalization and HMAC", () => {
  it("produces a stable, pipe-delimited canonical string", () => {
    const c = canonicalize({
      intentId: "abc",
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reason: "AMOUNT_ANOMALOUS",
      expiresAt: "2026-09-12T00:01:00.000Z",
    });
    expect(c).toBe("abc|gas-oracle.local|0.0.123|0.08000000|AMOUNT_ANOMALOUS|2026-09-12T00:01:00.000Z");
  });

  it("matches a known-good HMAC test vector against the fixture secret (cross-check with firmware/hmac_bringup)", () => {
    const canonical = "abc-123|gas-oracle.local|0.0.10494790|0.08000000|AMOUNT_ANOMALOUS|2026-09-12T00:01:00.000Z";
    // Computed independently via:
    // node -e "console.log(require('crypto').createHmac('sha256','test-secret-do-not-use-in-prod').update('abc-123|gas-oracle.local|0.0.10494790|0.08000000|AMOUNT_ANOMALOUS|2026-09-12T00:01:00.000Z').digest('hex'))"
    expect(sign(canonical)).toBe("9aa7383b6d52b09d11d54e6ac137be479a1ea752a4766cc2d11aaa76b53e58c8");
  });

  it("verifies a signature produced by sign() over the same canonical string", () => {
    const canonical = "x|y|z|0.10000000|r|e";
    expect(verifyHmac(canonical, sign(canonical))).toBe(true);
  });

  it("rejects a tampered field (one byte changed) as an invalid signature", () => {
    const canonical = "x|y|z|0.10000000|r|e";
    const hmac = sign(canonical);
    const tampered = "x|y|z|0.20000000|r|e"; // amount changed after signing
    expect(verifyHmac(tampered, hmac)).toBe(false);
  });

  it("rejects a garbage hmac without throwing", () => {
    expect(verifyHmac("a|b|c|0.01000000|r|e", "not-hex")).toBe(false);
  });
});

describe("intents: lifecycle", () => {
  it("creates a PENDING intent and it is returned by getPendingIntent", () => {
    const intent = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    expect(intent.status).toBe("PENDING");
    expect(getPendingIntent(now)?.intent_id).toBe(intent.intent_id);
  });

  it("approves with a valid hmac and fresh nonce, then marks CONSUMED", () => {
    const intent = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    const result = approveIntent(intent.intent_id, "nonce-1", intent.hmac, now);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.intent.status).toBe("CONSUMED");
  });

  it("rejects approval with a tampered hmac", () => {
    const intent = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    const result = approveIntent(intent.intent_id, "nonce-2", "deadbeef".repeat(8), now);
    expect(result).toEqual({ ok: false, error: "BAD_HMAC" });
  });

  it("rejects a replayed nonce on the same intent", () => {
    const intent = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    const first = approveIntent(intent.intent_id, "nonce-shared", intent.hmac, now);
    expect(first.ok).toBe(true);

    // Create a second intent and attempt to reuse the same nonce.
    const intent2 = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.02,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    const replay = approveIntent(intent2.intent_id, "nonce-shared", intent2.hmac, now);
    expect(replay).toEqual({ ok: false, error: "NONCE_REUSED" });
  });

  it("rejects a second approval of an already-CONSUMED intent, even with a fresh nonce", () => {
    const intent = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    const first = approveIntent(intent.intent_id, "nonce-a", intent.hmac, now);
    expect(first.ok).toBe(true);

    const second = approveIntent(intent.intent_id, "nonce-b", intent.hmac, now);
    expect(second).toEqual({ ok: false, error: "NOT_PENDING" });
  });

  it("rejects approval after expiry", () => {
    const intent = createIntent({
      requestId: seedRequest(),
      service: "gas-oracle.local",
      recipient: "0.0.123",
      amountHbar: 0.08,
      reasonCode: "AMOUNT_ANOMALOUS",
      now,
    });
    const later = new Date(new Date(intent.expires_at).getTime() + 1000);
    const result = approveIntent(intent.intent_id, "nonce-late", intent.hmac, later);
    expect(result).toEqual({ ok: false, error: "EXPIRED" });
  });

  it("rejects approval of an unknown intent id", () => {
    const result = approveIntent("does-not-exist", "nonce-x", "irrelevant", now);
    expect(result).toEqual({ ok: false, error: "NOT_FOUND" });
  });
});
