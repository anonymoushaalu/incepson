// MOCKED -- these endpoints don't exist on the backend yet (Part B of
// docs/FRONTEND_PLAN.md). Every export here is a stand-in for a real fetch
// call with the same shape the real one will have, so swapping api.ts's
// re-exports for real implementations later requires no page changes.
//
// Every consumer of these MUST render a visible "(simulated)" or "(mock
// data)" label -- see components/MockBadge.tsx -- so nobody mistakes this
// for real backend state.

import type { RequestRow, PolicyConfig } from "./useAgentPayStore.js";

const MOCK_DELAY_MS = 150;
function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS));
}

export interface RequestDetail extends RequestRow {
  signals: { injection_detected: boolean; amount_anomalous: boolean };
  intent_id: string | null;
}

// GET /api/requests (planned)
export function fetchRequests(_filters?: { decision?: string; code?: string }): Promise<RequestRow[]> {
  return delay([]);
}

// GET /api/requests/:id (planned)
export function fetchRequestDetail(id: string): Promise<RequestDetail | null> {
  return delay({
    id,
    created_at: new Date().toISOString(),
    service: "gas-oracle.local",
    amount_hbar: 0.02,
    reason: "mock reason",
    decision: "ALLOW",
    decision_code: "OK",
    settled: 1,
    tx_id: null,
    signals: { injection_detected: false, amount_anomalous: false },
    intent_id: null,
  });
}

export interface IntentHistoryRow {
  intent_id: string;
  service: string;
  amount_hbar: number;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "CONSUMED";
  created_at: string;
  consumed_at: string | null;
}

// GET /api/intents (planned)
export function fetchIntentHistory(): Promise<IntentHistoryRow[]> {
  return delay([]);
}

export interface ChainTransaction {
  tx_id: string;
  amount_hbar: number;
  service: string;
  created_at: string;
  hashscan_url: string;
}

// GET /api/chain/transactions (planned)
export function fetchChainTransactions(): Promise<ChainTransaction[]> {
  return delay([]);
}

export interface ChainBalances {
  agentAccountId: string;
  agentBalanceHbar: number;
  merchantAccountId: string;
  merchantBalanceHbar: number;
}

// GET /api/chain/balances (planned)
export function fetchChainBalances(): Promise<ChainBalances | null> {
  return delay(null);
}

export interface PolicyGateCounters {
  not_allowlisted: number;
  over_tx_limit: number;
  over_daily_budget: number;
  injection_detected: number;
  amount_anomalous: number;
  ok: number;
}

// GET /api/policy/gates (planned)
export function fetchPolicyGateCounters(): Promise<PolicyGateCounters> {
  return delay({
    not_allowlisted: 0,
    over_tx_limit: 0,
    over_daily_budget: 0,
    injection_detected: 0,
    amount_anomalous: 0,
    ok: 0,
  });
}

export interface SimulateResult {
  decision: "ALLOW" | "ESCALATE" | "DENY";
  code: string;
  explanation: string;
}

// POST /api/policy/simulate (planned) -- until it exists, /policy's
// simulator falls back to the client port in policy/evaluate.ts instead of
// this mock, since that port can actually run the real logic client-side.
export function simulatePolicy(_service: string, _amountHbar: number, _policy: PolicyConfig): Promise<SimulateResult> {
  return delay({ decision: "DENY", code: "MOCK_NOT_WIRED", explanation: "This mock is unused; see policy/evaluate.ts." });
}
