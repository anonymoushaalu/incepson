import { describe, it, expect, vi } from "vitest";

vi.stubEnv("DEVICE_HMAC_SECRET", "test-secret-do-not-use-in-prod");
vi.stubEnv("DB_PATH", ":memory:");
vi.stubEnv("MERCHANT_ACCOUNT_ID", "0.0.999");

const { requestPayment, resolveEscalation, setDemoBudgetOverride } = await import("./index.js");
const { getPendingIntent, approveIntent } = await import("../intents/index.js");
const { resetBudgetWindow } = await import("../ledger/index.js");

describe("broker: demo budget override and the drip sequence", () => {
  it("five 0.05 HBAR charges settle autonomously under the real 0.30 budget with no wall", async () => {
    resetBudgetWindow(new Date());
    setDemoBudgetOverride(null);
    const decisions: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await requestPayment(
        { service: "eth-price.local", amount_hbar: 0.05, reason: "drip" },
        { settle: async () => ({ txId: `tx-${i}` }) }
      );
      decisions.push(r.result.decision);
    }
    // 5 * 0.05 = 0.25 <= 0.30: none of them hit the wall.
    expect(decisions).toEqual(["ALLOW", "ALLOW", "ALLOW", "ALLOW", "ALLOW"]);
  });

  it("the same five charges hit the wall on the fifth once the demo budget is shrunk to 0.22", async () => {
    resetBudgetWindow(new Date());
    setDemoBudgetOverride(0.22);
    const decisions: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await requestPayment(
        { service: "eth-price.local", amount_hbar: 0.05, reason: "drip" },
        { settle: async () => ({ txId: `tx-b-${i}` }) }
      );
      decisions.push(r.result.decision);
    }
    // 0.05*4=0.20<=0.22 (allow), 0.20+0.05=0.25>0.22 (deny on the 5th).
    expect(decisions).toEqual(["ALLOW", "ALLOW", "ALLOW", "ALLOW", "DENY"]);
    expect(decisions.filter((d) => d === "DENY")).toHaveLength(1);
    setDemoBudgetOverride(null);
  });

  it("full escalation loop: creates an intent, waits, settles from the intent's fields on approval", async () => {
    resetBudgetWindow(new Date());
    let settledWith: unknown;
    const brokerPromise = requestPayment(
      { service: "gas-oracle.local", amount_hbar: 0.08, reason: "escalation test" },
      { settle: async (req) => { settledWith = req; return { txId: "esc-tx" }; } }
    );

    await new Promise((r) => setTimeout(r, 50));
    const pending = getPendingIntent();
    expect(pending?.amount_hbar).toBe(0.08);
    if (!pending) throw new Error("no pending intent");

    const approved = approveIntent(pending.intent_id, "test-nonce", pending.hmac, new Date());
    expect(approved.ok).toBe(true);
    resolveEscalation(pending.intent_id, true);

    const result = await brokerPromise;
    expect(result.txId).toBe("esc-tx");
    expect(settledWith).toEqual({ service: "gas-oracle.local", amount_hbar: 0.08, reason: "AMOUNT_ANOMALOUS" });
  });
});
