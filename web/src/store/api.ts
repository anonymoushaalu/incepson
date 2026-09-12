// The ONLY file that makes network calls. Part B (REST) implements the real
// endpoints this file currently mocks -- see mock.ts for exactly which ones,
// and docs/FRONTEND_PLAN.md Part B for their planned shape. No page component
// should ever call fetch() or new EventSource() directly; go through here or
// through useAgentPayStore.connect() for the SSE stream.

import * as mock from "./mock.js";

export async function fetchState() {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
  return res.json();
}

export interface RunAgentResult {
  transcript?: string[];
  /** Present on failure -- e.g. the OpenAI account has no credits. The
   *  backend returns 502 with this shape; res.ok is false but the body is
   *  still valid JSON, so callers should check for .error rather than
   *  relying on res.ok having been inspected here. */
  error?: string;
}

export async function runAgent(body: { scenario?: string; task?: string }): Promise<RunAgentResult> {
  const res = await fetch("/api/agent/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function resetDay() {
  const res = await fetch("/api/dev/reset-day", { method: "POST" });
  return res.json();
}

export async function setDemoBudget(dailyBudgetHbar: number) {
  const res = await fetch("/api/dev/demo-budget", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ daily_budget_hbar: dailyBudgetHbar }),
  });
  return res.json();
}

export async function approveDevice(intentId: string, nonce: string, hmac: string) {
  const res = await fetch("/device/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent_id: intentId, nonce, hmac }),
  });
  return res.json();
}

export async function getPendingIntent() {
  const res = await fetch("/device/pending");
  if (res.status === 204) return null;
  return res.json();
}

// --- Mocked below: no backend endpoint exists yet (Part B, see FRONTEND_PLAN.md) ---

export const fetchRequests = mock.fetchRequests;
export const fetchRequestDetail = mock.fetchRequestDetail;
export const fetchIntentHistory = mock.fetchIntentHistory;
export const fetchChainTransactions = mock.fetchChainTransactions;
export const fetchChainBalances = mock.fetchChainBalances;
export const fetchPolicyGateCounters = mock.fetchPolicyGateCounters;
export const simulatePolicy = mock.simulatePolicy;
