import { randomUUID } from "node:crypto";
import { evaluate } from "../policy/engine.js";
import { evaluateSignals } from "../signals/index.js";
import { policy } from "../config.js";
import { spentInWindow, settledAmountsForService, recordRequest, markSettled } from "../ledger/index.js";
import type { PaymentRequest, PolicyResult } from "../policy/types.js";

// The ONLY caller of policy.evaluate() and the ONLY module besides
// payments/x402.ts that settles a payment. ALLOW settles, DENY records and
// refuses with no retry affordance, ESCALATE is wired in Phase 4.
export interface BrokerResult {
  requestId: string;
  result: PolicyResult;
  txId?: string;
}

export async function requestPayment(
  req: PaymentRequest,
  opts: { rawMerchantBody?: string; settle: (req: PaymentRequest) => Promise<{ txId: string }> },
  now: Date = new Date()
): Promise<BrokerResult> {
  const requestId = randomUUID();
  const spend = { spent_window_hbar: spentInWindow(now) };
  const history = { settledAmountsForService: settledAmountsForService(req.service) };
  const signals = evaluateSignals(req.amount_hbar, opts.rawMerchantBody, history, policy);

  const result = evaluate(req, policy, spend, signals, now);

  if (result.decision === "DENY") {
    recordRequest({
      id: requestId,
      req,
      decision: result.decision,
      decisionCode: result.code,
      signals,
      settled: false,
      now,
    });
    return { requestId, result };
  }

  if (result.decision === "ESCALATE") {
    // Phase 4: create a signed intent, park a promise, resolve on device
    // approval or timeout. Recorded as pending (not settled) for now.
    recordRequest({
      id: requestId,
      req,
      decision: result.decision,
      decisionCode: result.code,
      signals,
      settled: false,
      now,
    });
    return { requestId, result };
  }

  // ALLOW
  const { txId } = await opts.settle(req);
  recordRequest({
    id: requestId,
    req,
    decision: result.decision,
    decisionCode: result.code,
    signals,
    settled: true,
    txId,
    now,
  });
  return { requestId, result, txId };
}
