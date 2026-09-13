import { describe, it, expect, vi } from "vitest";

vi.stubEnv("DB_PATH", ":memory:");

const { db } = await import("../db.js");
const { queryRequests, getRequestById, decisionCodeCounts } = await import("./index.js");

const now = new Date("2026-09-12T00:00:00.000Z");

let counter = 0;
function seedRequest(overrides: Partial<{
  service: string;
  amount_hbar: number;
  decision: string;
  decision_code: string;
  settled: number;
  tx_id: string | null;
  created_at: string;
}> = {}): string {
  const id = `req-${++counter}`;
  db.prepare(
    `INSERT INTO payment_requests (id, created_at, service, amount_hbar, reason, decision, decision_code, signals_json, settled, tx_id)
     VALUES (@id, @created_at, @service, @amount_hbar, 'test', @decision, @decision_code, @signals_json, @settled, @tx_id)`
  ).run({
    id,
    created_at: overrides.created_at ?? new Date(now.getTime() + counter * 1000).toISOString(),
    service: overrides.service ?? "gas-oracle.local",
    amount_hbar: overrides.amount_hbar ?? 0.02,
    decision: overrides.decision ?? "ALLOW",
    decision_code: overrides.decision_code ?? "OK",
    signals_json: JSON.stringify({ injection_detected: false, amount_anomalous: false }),
    settled: overrides.settled ?? 1,
    tx_id: overrides.tx_id ?? null,
  });
  return id;
}

describe("ledger: queryRequests", () => {
  it("returns all requests newest-first with no filters", () => {
    const a = seedRequest();
    const b = seedRequest();
    const { rows, total } = queryRequests();
    expect(total).toBe(2);
    expect(rows.map((r) => r.id)).toEqual([b, a]); // newest first
  });

  it("filters by decision", () => {
    seedRequest({ decision: "ALLOW", decision_code: "OK" });
    seedRequest({ decision: "DENY", decision_code: "NOT_ALLOWLISTED", settled: 0 });
    const { rows, total } = queryRequests({ decision: "DENY" });
    expect(total).toBe(1);
    expect(rows[0].decision).toBe("DENY");
  });

  it("filters by decision_code", () => {
    seedRequest({ decision_code: "OVER_TX_LIMIT", decision: "DENY", settled: 0 });
    const { rows, total } = queryRequests({ code: "OVER_TX_LIMIT" });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(rows.every((r) => r.decision_code === "OVER_TX_LIMIT")).toBe(true);
  });

  it("filters by service", () => {
    seedRequest({ service: "eth-price.local" });
    const { rows } = queryRequests({ service: "eth-price.local" });
    expect(rows.every((r) => r.service === "eth-price.local")).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it("filters by since (inclusive)", () => {
    const cutoff = new Date(now.getTime() + 500_000).toISOString();
    seedRequest({ created_at: new Date(now.getTime() + 600_000).toISOString() });
    const { rows } = queryRequests({ since: cutoff });
    expect(rows.every((r) => r.created_at >= cutoff)).toBe(true);
  });

  it("combines filters with AND", () => {
    seedRequest({ service: "combo-test.local", decision: "DENY", decision_code: "NOT_ALLOWLISTED", settled: 0 });
    seedRequest({ service: "combo-test.local", decision: "ALLOW", decision_code: "OK" });
    const { rows, total } = queryRequests({ service: "combo-test.local", decision: "DENY" });
    expect(total).toBe(1);
    expect(rows[0].decision).toBe("DENY");
    expect(rows[0].service).toBe("combo-test.local");
  });

  it("paginates with limit/offset and reports the true total separately", () => {
    for (let i = 0; i < 5; i++) seedRequest({ service: "page-test.local" });
    const page1 = queryRequests({ service: "page-test.local", limit: 2, offset: 0 });
    const page2 = queryRequests({ service: "page-test.local", limit: 2, offset: 2 });
    expect(page1.rows).toHaveLength(2);
    expect(page2.rows).toHaveLength(2);
    expect(page1.total).toBe(5);
    expect(page2.total).toBe(5);
    expect(page1.rows[0].id).not.toBe(page2.rows[0].id);
  });

  it("clamps limit to the 1-500 range", () => {
    seedRequest();
    const { rows: tooLow } = queryRequests({ limit: 0 });
    const { rows: tooHigh } = queryRequests({ limit: 10_000 });
    expect(tooLow.length).toBeLessThanOrEqual(1);
    expect(tooHigh.length).toBeLessThanOrEqual(500);
  });
});

describe("ledger: getRequestById", () => {
  it("returns the matching row", () => {
    const id = seedRequest({ service: "lookup-test.local" });
    const row = getRequestById(id);
    expect(row?.service).toBe("lookup-test.local");
  });

  it("returns undefined for an unknown id", () => {
    expect(getRequestById("does-not-exist")).toBeUndefined();
  });
});

describe("ledger: decisionCodeCounts", () => {
  it("counts requests grouped by decision_code", () => {
    seedRequest({ decision_code: "COUNT_TEST_A" });
    seedRequest({ decision_code: "COUNT_TEST_A" });
    seedRequest({ decision_code: "COUNT_TEST_B" });
    const counts = decisionCodeCounts();
    expect(counts.COUNT_TEST_A).toBe(2);
    expect(counts.COUNT_TEST_B).toBe(1);
  });
});
