// Client-side PORT of src/policy/engine.ts for the /policy simulator ONLY.
// This is not the authoritative decision -- the server's copy is. Kept
// byte-identical in logic (not imported directly: the frontend and backend
// are separate packages/builds) so the simulator agrees with the server on
// the same input. If src/policy/engine.ts changes, this must change with
// it -- there is no build-time guard against drift; Part B's planned
// POST /api/policy/simulate replaces this file with a real server round
// trip once it exists (see docs/FRONTEND_PLAN.md Part B).
import type { PolicyConfig } from "../store/useAgentPayStore.js";

export type Decision = "ALLOW" | "ESCALATE" | "DENY";

export interface Signals {
  injection_detected: boolean;
  amount_anomalous: boolean;
}

export interface SpendState {
  spent_window_hbar: number;
}

export interface PaymentRequest {
  service: string;
  amount_hbar: number;
}

export interface PolicyResult {
  decision: Decision;
  code: string;
  explanation: string;
  /** Which gate produced this result, for highlighting in the rule chain UI. */
  gate: "allowlist" | "tx_limit" | "daily_budget" | "injection" | "anomaly" | "allow";
}

export function evaluateClient(req: PaymentRequest, config: PolicyConfig, spend: SpendState, signals: Signals): PolicyResult {
  if (!config.service_allowlist.includes(req.service)) {
    return {
      decision: "DENY",
      code: "NOT_ALLOWLISTED",
      explanation: `Service "${req.service}" is not on the allowlist.`,
      gate: "allowlist",
    };
  }

  const toTinybar = (hbar: number) => Math.round(hbar * 1e8);

  if (toTinybar(req.amount_hbar) > toTinybar(config.max_tx_hbar)) {
    return {
      decision: "DENY",
      code: "OVER_TX_LIMIT",
      explanation: `Requested ${req.amount_hbar} HBAR exceeds the per-transaction limit of ${config.max_tx_hbar} HBAR.`,
      gate: "tx_limit",
    };
  }

  if (toTinybar(spend.spent_window_hbar) + toTinybar(req.amount_hbar) > toTinybar(config.daily_budget_hbar)) {
    return {
      decision: "DENY",
      code: "OVER_DAILY_BUDGET",
      explanation: `Spending ${req.amount_hbar} HBAR would exceed the remaining budget (${(config.daily_budget_hbar - spend.spent_window_hbar).toFixed(8)} HBAR left of ${config.daily_budget_hbar} HBAR).`,
      gate: "daily_budget",
    };
  }

  if (config.escalate_on.includes("injection_detected") && signals.injection_detected) {
    return {
      decision: "ESCALATE",
      code: "INJECTION_DETECTED",
      explanation: "The merchant response contained a suspected injected payment instruction.",
      gate: "injection",
    };
  }

  if (config.escalate_on.includes("amount_anomalous") && signals.amount_anomalous) {
    return {
      decision: "ESCALATE",
      code: "AMOUNT_ANOMALOUS",
      explanation: `Requested ${req.amount_hbar} HBAR is above the soft limit and requires human approval.`,
      gate: "anomaly",
    };
  }

  return {
    decision: "ALLOW",
    code: "OK",
    explanation: `${req.amount_hbar} HBAR to "${req.service}" is within limits.`,
    gate: "allow",
  };
}

/** amount_anomalous per src/signals/index.ts: soft_limit_hbar until a
 *  service has enough settled samples for p95 to be meaningful (never true
 *  client-side, since the simulator has no ledger history -- this always
 *  falls back to the soft-limit comparison, which is what a fresh demo run
 *  actually does anyway). */
export function isAmountAnomalousClient(amountHbar: number, config: PolicyConfig): boolean {
  return amountHbar > config.soft_limit_hbar;
}

/** Ported from src/signals/index.ts detectInjection/compilePatterns exactly,
 *  including the JS-has-no-(?i)-flag caveat noted there -- left unstripped,
 *  every pattern silently stops matching. */
export function detectInjectionClient(rawBody: string, config: PolicyConfig): boolean {
  const patterns = config.injection_patterns.map((p) => new RegExp(p.replace(/^\(\?i\)/, ""), "i"));
  return patterns.some((re) => re.test(rawBody));
}
