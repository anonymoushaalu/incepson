import type { PolicyConfig, Signals } from "../policy/types.js";

// Compiled once per config load. JS has no (?i) inline flag: strip the
// prefix and pass "i" -- left in, it parses as a literal group and the
// pattern silently never matches. Verified against real attack/honest
// payloads; see docs/RUNBOOK.md for the test cases.
function compilePatterns(patterns: string[]): RegExp[] {
  return patterns.map((p) => new RegExp(p.replace(/^\(\?i\)/, ""), "i"));
}

/**
 * Scans the raw merchant response body for an injected payment instruction,
 * before the agent ever sees it. Deterministic regex, no LLM in the loop.
 * Deliberately crude: the claim is "detection is outside the model", not
 * "detection is complete".
 */
export function detectInjection(rawBody: string, config: PolicyConfig): boolean {
  const patterns = compilePatterns(config.injection_patterns);
  return patterns.some((re) => re.test(rawBody));
}

export interface AmountHistory {
  settledAmountsForService: number[];
}

/**
 * amount_anomalous: p95-over-history once a service has enough settled
 * transactions to make a percentile meaningful (config.p95_min_sample);
 * a fixed soft_limit_hbar until then. A 3-day demo will have single-digit
 * transaction counts per service, where p95 is statistically meaningless,
 * so the fallback is what actually fires during the pitch.
 */
export function isAmountAnomalous(
  amountHbar: number,
  history: AmountHistory,
  config: PolicyConfig
): boolean {
  const samples = history.settledAmountsForService;
  if (samples.length < config.p95_min_sample) {
    return amountHbar > config.soft_limit_hbar;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  const p95 = sorted[idx];
  return amountHbar > p95;
}

export function evaluateSignals(
  amountHbar: number,
  rawMerchantBody: string | undefined,
  history: AmountHistory,
  config: PolicyConfig
): Signals {
  return {
    injection_detected: rawMerchantBody ? detectInjection(rawMerchantBody, config) : false,
    amount_anomalous: isAmountAnomalous(amountHbar, history, config),
  };
}
