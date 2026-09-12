import type { PaymentRequest, PolicyConfig, PolicyResult, Signals, SpendState } from "./types.js";

/**
 * Pure. No I/O, no network, no Date.now(), no LLM. `now` is injected so this
 * is testable with a frozen clock. This function is the entire security claim.
 *
 * Implemented in Phase 2.
 */
export function evaluate(
  req: PaymentRequest,
  config: PolicyConfig,
  spend: SpendState,
  signals: Signals,
  now: Date
): PolicyResult {
  throw new Error("Phase 2");
}
