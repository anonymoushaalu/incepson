import { randomUUID } from "node:crypto";
import { evaluate } from "../policy/engine.js";
import { evaluateSignals } from "../signals/index.js";
import { policy, env } from "../config.js";
import { spentInWindow, settledAmountsForService, recordRequest, markSettled } from "../ledger/index.js";
import { publish } from "../bus.js";
import { createIntent, expireStaleIntents, type IntentRow } from "../intents/index.js";
import type { PaymentRequest, PolicyResult } from "../policy/types.js";

// The ONLY caller of policy.evaluate() and the ONLY module besides
// payments/x402.ts that settles a payment. ALLOW settles immediately, DENY
// records and refuses with no retry affordance, ESCALATE creates a signed
// intent and waits for device approval or timeout.
export interface BrokerResult {
  requestId: string;
  result: PolicyResult;
  txId?: string;
  intentId?: string;
}

// Parked promises for pending escalations, resolved by routes/device.ts on
// approval or by the timeout below. One merchant process backs every
// allowlisted service in this MVP, so the recipient is always its account.
const pendingEscalations = new Map<string, { resolve: (approved: boolean) => void }>();

// Demo-only override for the drip scenario: five sub-soft-limit charges
// (each individually ALLOW) need a budget small enough that the fifth one
// crosses it within a single demo run, without shrinking the real
// policy.json value used by scenes 1-3. null = use policy.daily_budget_hbar.
// Set via POST /api/dev/demo-budget, cleared by /api/dev/reset-day.
let demoBudgetOverrideHbar: number | null = null;

export function setDemoBudgetOverride(hbar: number | null): void {
  demoBudgetOverrideHbar = hbar;
}

export function resolveEscalation(intentId: string, approved: boolean): boolean {
  const parked = pendingEscalations.get(intentId);
  if (!parked) return false;
  pendingEscalations.delete(intentId);
  parked.resolve(approved);
  return true;
}

export async function requestPayment(
  req: PaymentRequest,
  opts: { rawMerchantBody?: string; settle: (req: PaymentRequest) => Promise<{ txId: string }> },
  now: Date = new Date()
): Promise<BrokerResult> {
  const requestId = randomUUID();
  const effectivePolicy =
    demoBudgetOverrideHbar === null ? policy : { ...policy, daily_budget_hbar: demoBudgetOverrideHbar };
  const spend = { spent_window_hbar: spentInWindow(now) };
  const history = { settledAmountsForService: settledAmountsForService(req.service) };
  const signals = evaluateSignals(req.amount_hbar, opts.rawMerchantBody, history, effectivePolicy);

  const result = evaluate(req, effectivePolicy, spend, signals, now);

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
    publish({ type: "decision", requestId, service: req.service, amountHbar: req.amount_hbar, decision: result.decision, code: result.code, explanation: result.explanation });
    return { requestId, result };
  }

  if (result.decision === "ESCALATE") {
    recordRequest({
      id: requestId,
      req,
      decision: result.decision,
      decisionCode: result.code,
      signals,
      settled: false,
      now,
    });

    const intent = createIntent({
      requestId,
      service: req.service,
      recipient: env.merchantAccountId,
      amountHbar: req.amount_hbar,
      reasonCode: result.code,
      now,
    });
    publish({ type: "decision", requestId, service: req.service, amountHbar: req.amount_hbar, decision: result.decision, code: result.code, explanation: result.explanation });
    publish({ type: "intent_pending", intent });

    const approved = await waitForApproval(intent, policy.escalation_timeout_sec);
    if (!approved) {
      // A device approval racing this exact instant is rejected downstream:
      // approveIntent only succeeds on a still-PENDING row, and this marks
      // it EXPIRED atomically via the same status column it checks.
      expireStaleIntents(new Date());
      publish({ type: "intent_timeout", intentId: intent.intent_id });
      return { requestId, result: { ...result, code: "ESCALATION_TIMEOUT" }, intentId: intent.intent_id };
    }

    // Settlement reads THE INTENT'S fields, never the agent's re-supplied
    // request object -- closes the swap hole: a request mutated after
    // escalation cannot redirect an approved payment.
    const { txId } = await opts.settle({
      service: intent.service,
      amount_hbar: intent.amount_hbar,
      reason: intent.reason,
    });
    markSettled(requestId, txId);
    publish({ type: "decision", requestId, service: intent.service, amountHbar: intent.amount_hbar, decision: "ALLOW", code: "APPROVED_BY_DEVICE", explanation: "Approved by physical button press.", txId });
    return { requestId, result, txId, intentId: intent.intent_id };
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
  publish({ type: "decision", requestId, service: req.service, amountHbar: req.amount_hbar, decision: result.decision, code: result.code, explanation: result.explanation, txId });
  return { requestId, result, txId };
}

function waitForApproval(intent: IntentRow, timeoutSec: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingEscalations.delete(intent.intent_id);
      resolve(false);
    }, timeoutSec * 1000);

    pendingEscalations.set(intent.intent_id, {
      resolve: (approved) => {
        clearTimeout(timer);
        resolve(approved);
      },
    });
  });
}
