import { describe, it, expect } from "vitest";
import { evaluate } from "./engine.js";
import type { PolicyConfig, Signals } from "./types.js";

const config: PolicyConfig = {
  agent_id: "research-agent-01",
  max_tx_hbar: 0.10,
  soft_limit_hbar: 0.05,
  daily_budget_hbar: 0.30,
  budget_window: "rolling_24h",
  p95_min_sample: 20,
  service_allowlist: ["gas-oracle.local", "eth-price.local"],
  escalate_on: ["injection_detected", "amount_anomalous"],
  escalation_timeout_sec: 60,
  injection_patterns: [],
};

const noSignals: Signals = { injection_detected: false, amount_anomalous: false };
const now = new Date("2026-09-12T00:00:00.000Z");

function req(service: string, amount_hbar: number, reason = "test") {
  return { service, amount_hbar, reason };
}

describe("policy engine: allowlist boundary", () => {
  it("allows an in-budget request to an allowlisted service", () => {
    const r = evaluate(req("gas-oracle.local", 0.02), config, { spent_window_hbar: 0 }, noSignals, now);
    expect(r.decision).toBe("ALLOW");
    expect(r.code).toBe("OK");
  });

  it("denies a service not on the allowlist, unconditionally", () => {
    const r = evaluate(req("evil.example", 0.01), config, { spent_window_hbar: 0 }, noSignals, now);
    expect(r.decision).toBe("DENY");
    expect(r.code).toBe("NOT_ALLOWLISTED");
  });

  it("denies not-allowlisted even when signals suggest escalation (allowlist is unconditional, no appeal)", () => {
    const r = evaluate(
      req("evil.example", 0.01),
      config,
      { spent_window_hbar: 0 },
      { injection_detected: true, amount_anomalous: true },
      now
    );
    expect(r.decision).toBe("DENY");
    expect(r.code).toBe("NOT_ALLOWLISTED");
  });
});

describe("policy engine: per-transaction limit", () => {
  it("denies a request over max_tx_hbar", () => {
    const r = evaluate(req("gas-oracle.local", 0.11), config, { spent_window_hbar: 0 }, noSignals, now);
    expect(r.decision).toBe("DENY");
    expect(r.code).toBe("OVER_TX_LIMIT");
  });

  it("allows exactly at the max_tx_hbar boundary", () => {
    const r = evaluate(req("gas-oracle.local", 0.10), config, { spent_window_hbar: 0 }, noSignals, now);
    expect(r.decision).toBe("ALLOW");
  });

  it("denies one unit above the max_tx_hbar boundary", () => {
    const r = evaluate(req("gas-oracle.local", 0.10 + 1e-8), config, { spent_window_hbar: 0 }, noSignals, now);
    expect(r.decision).toBe("DENY");
    expect(r.code).toBe("OVER_TX_LIMIT");
  });
});

describe("policy engine: daily aggregate budget", () => {
  it("allows exactly at the daily_budget_hbar boundary (spent + amount == budget)", () => {
    const r = evaluate(req("gas-oracle.local", 0.10), config, { spent_window_hbar: 0.20 }, noSignals, now);
    expect(r.decision).toBe("ALLOW");
  });

  it("denies one unit above the daily_budget_hbar boundary", () => {
    const r = evaluate(req("gas-oracle.local", 0.10), config, { spent_window_hbar: 0.20 + 1e-8 }, noSignals, now);
    expect(r.decision).toBe("DENY");
    expect(r.code).toBe("OVER_DAILY_BUDGET");
  });

  it("denies the request that would cross the budget when it is also anomalous or injected (hard denial before escalation)", () => {
    const r = evaluate(
      req("gas-oracle.local", 0.08),
      config,
      { spent_window_hbar: 0.25 },
      { injection_detected: false, amount_anomalous: true },
      now
    );
    expect(r.decision).toBe("DENY");
    expect(r.code).toBe("OVER_DAILY_BUDGET");
  });

  it("the drip attack: five individually-legal 0.08 HBAR charges against a 0.30 budget deny on the fourth", () => {
    let spent = 0;
    const decisions: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = evaluate(req("gas-oracle.local", 0.08), config, { spent_window_hbar: spent }, noSignals, now);
      decisions.push(r.decision);
      if (r.decision === "ALLOW") spent += 0.08;
    }
    // 0.08*3 = 0.24 <= 0.30 (allow), 0.24+0.08=0.32 > 0.30 (deny on the 4th and 5th)
    expect(decisions).toEqual(["ALLOW", "ALLOW", "ALLOW", "DENY", "DENY"]);
    expect(spent).toBeCloseTo(0.24, 8);
  });
});

describe("policy engine: escalation signals", () => {
  it("escalates on injection_detected when in budget and allowlisted", () => {
    const r = evaluate(
      req("gas-oracle.local", 0.02),
      config,
      { spent_window_hbar: 0 },
      { injection_detected: true, amount_anomalous: false },
      now
    );
    expect(r.decision).toBe("ESCALATE");
    expect(r.code).toBe("INJECTION_DETECTED");
  });

  it("escalates on amount_anomalous (soft limit) when in budget and allowlisted", () => {
    const r = evaluate(
      req("gas-oracle.local", 0.08),
      config,
      { spent_window_hbar: 0 },
      { injection_detected: false, amount_anomalous: true },
      now
    );
    expect(r.decision).toBe("ESCALATE");
    expect(r.code).toBe("AMOUNT_ANOMALOUS");
  });

  it("injection_detected takes precedence over amount_anomalous when both fire", () => {
    const r = evaluate(
      req("gas-oracle.local", 0.08),
      config,
      { spent_window_hbar: 0 },
      { injection_detected: true, amount_anomalous: true },
      now
    );
    expect(r.decision).toBe("ESCALATE");
    expect(r.code).toBe("INJECTION_DETECTED");
  });
});
