import type { PaymentRequest, PolicyConfig, PolicyResult, Signals, SpendState } from "./types.js";

/**
 * Pure. No I/O, no network, no Date.now(), no LLM. `now` is injected so this
 * is testable with a frozen clock. This function is the entire security claim.
 *
 * Evaluation order is itself a security property: hard denials (allowlist,
 * per-transaction limit, aggregate budget) are checked before escalation
 * signals. A request that is both anomalous and over budget must DENY, not
 * ESCALATE -- otherwise a human could be socially engineered into approving
 * something the policy already forbids.
 *
 * The allowlist is an unconditional boundary: a service not in
 * service_allowlist is DENIED, with no escalation path. (Resolves the
 * blueprint's unknown_service contradiction -- see docs/PLAN.md.)
 */
export function evaluate(
  req: PaymentRequest,
  config: PolicyConfig,
  spend: SpendState,
  signals: Signals,
  _now: Date
): PolicyResult {
  if (!config.service_allowlist.includes(req.service)) {
    return {
      decision: "DENY",
      code: "NOT_ALLOWLISTED",
      explanation: `Service "${req.service}" is not on the allowlist.`,
    };
  }

  // HBAR has 8 decimals; compare in tinybar-scaled integers so IEEE-754
  // rounding (e.g. 0.20 + 0.10 !== 0.30) can't deny an exact-boundary amount
  // that should be allowed.
  const toTinybar = (hbar: number) => Math.round(hbar * 1e8);

  if (toTinybar(req.amount_hbar) > toTinybar(config.max_tx_hbar)) {
    return {
      decision: "DENY",
      code: "OVER_TX_LIMIT",
      explanation: `Requested ${req.amount_hbar} HBAR exceeds the per-transaction limit of ${config.max_tx_hbar} HBAR.`,
    };
  }

  if (toTinybar(spend.spent_window_hbar) + toTinybar(req.amount_hbar) > toTinybar(config.daily_budget_hbar)) {
    return {
      decision: "DENY",
      code: "OVER_DAILY_BUDGET",
      explanation: `Spending ${req.amount_hbar} HBAR would exceed the remaining budget (${(config.daily_budget_hbar - spend.spent_window_hbar).toFixed(8)} HBAR left of ${config.daily_budget_hbar} HBAR).`,
    };
  }

  if (config.escalate_on.includes("injection_detected") && signals.injection_detected) {
    return {
      decision: "ESCALATE",
      code: "INJECTION_DETECTED",
      explanation: "The merchant response contained a suspected injected payment instruction.",
    };
  }

  if (config.escalate_on.includes("amount_anomalous") && signals.amount_anomalous) {
    return {
      decision: "ESCALATE",
      code: "AMOUNT_ANOMALOUS",
      explanation: `Requested ${req.amount_hbar} HBAR is above the soft limit and requires human approval.`,
    };
  }

  return {
    decision: "ALLOW",
    code: "OK",
    explanation: `${req.amount_hbar} HBAR to "${req.service}" is within limits.`,
  };
}
