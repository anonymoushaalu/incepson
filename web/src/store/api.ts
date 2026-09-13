// The ONLY file that makes network calls. No page component should ever
// call fetch() or new EventSource() directly -- go through here, or through
// useAgentPayStore.connect() for the SSE stream.
//
// Part A built this against docs/FRONTEND_PLAN.md's Part B contract before
// the real endpoints existed; every one of them is now real (Part B is
// complete), so the mock.ts seam that used to back this file has been
// removed entirely rather than kept around unused.

export async function fetchState() {
  const res = await fetch("/api/state");
  if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
  return res.json();
}

export interface RunAgentResult {
  transcript?: string[];
  requestId?: string;
  txId?: string;
  /** Present on failure -- e.g. the OpenAI account has no credits. The
   *  backend returns 502 with this shape; res.ok is false but the body is
   *  still valid JSON, so callers should check for .error rather than
   *  relying on res.ok having been inspected here. */
  error?: string;
  code?: string;
}

export async function runAgent(body: { scenario?: string; task?: string }): Promise<RunAgentResult> {
  const res = await fetch("/api/agent/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** POST /api/dev/scenario/:name -- runs a named scenario without the LLM.
 *  Real: goes through the same broker/settlement path as runAgent, just
 *  with a fixed request instead of an LLM turn. Can take up to
 *  escalation_timeout_sec (60s) to resolve if the scenario escalates and
 *  nothing approves it -- that wait is the real behavior, not a bug: it
 *  means the injection signal correctly asked a human, and nobody was
 *  there to press the button. */
export async function runScenario(name: string): Promise<RunAgentResult> {
  const res = await fetch(`/api/dev/scenario/${name}`, { method: "POST" });
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

/** POST /api/device/simulate-approve -- software-approves a pending intent
 *  for rehearsal when the ESP32 isn't wired up. This is NOT a bypass: the
 *  server signs the same canonical string with its own DEVICE_HMAC_SECRET
 *  and goes through the exact same approveIntent() path a real device
 *  approval does. Always render this action's result with a "(simulated)"
 *  label -- see components/MockBadge.tsx. */
export async function simulateApprove(intentId: string) {
  const res = await fetch("/api/device/simulate-approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent_id: intentId }),
  });
  return res.json();
}

export async function getPendingIntent() {
  const res = await fetch("/device/pending");
  if (res.status === 204) return null;
  return res.json();
}

export interface RequestRowFilters {
  decision?: "ALLOW" | "ESCALATE" | "DENY";
  code?: string;
  service?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

// GET /api/requests
export async function fetchRequests(filters: RequestRowFilters = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined) params.set(k, String(v));
  }
  const res = await fetch(`/api/requests?${params}`);
  return res.json() as Promise<{ rows: unknown[]; total: number }>;
}

// GET /api/requests/:id
export async function fetchRequestDetail(id: string) {
  const res = await fetch(`/api/requests/${id}`);
  if (res.status === 404) return null;
  return res.json();
}

export interface IntentHistoryRow {
  intent_id: string;
  service: string;
  amount_hbar: number;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "CONSUMED";
  expires_at: string;
  consumed_at: string | null;
}

// GET /api/intents
export async function fetchIntentHistory(): Promise<IntentHistoryRow[]> {
  const res = await fetch("/api/intents");
  return res.json();
}

export interface ChainTransaction {
  tx_id: string;
  amount_hbar: number;
  service: string;
  created_at: string;
  request_id: string;
  hashscan_url: string;
}

// GET /api/chain/transactions
export async function fetchChainTransactions(): Promise<ChainTransaction[]> {
  const res = await fetch("/api/chain/transactions");
  return res.json();
}

export interface ChainBalances {
  agentAccountId: string;
  agentBalanceHbar: number | null;
  merchantAccountId: string;
  merchantBalanceHbar: number | null;
  /** Live HBAR/USD price from Chainlink's deployed feed on Hedera testnet
   *  (read via the Hashio EVM JSON-RPC relay), null if the RPC call failed. */
  hbarUsd: number | null;
}

// GET /api/chain/balances -- a live Hedera mirror-node lookup, cached 15s server-side.
export async function fetchChainBalances(): Promise<ChainBalances> {
  const res = await fetch("/api/chain/balances");
  return res.json();
}

export interface PolicyGateCounters {
  allowlist: number;
  tx_limit: number;
  daily_budget: number;
  injection: number;
  anomaly: number;
  allow: number;
  escalation_timeout: number;
  approved_by_device: number;
}

// GET /api/policy/gates
export async function fetchPolicyGateCounters(): Promise<PolicyGateCounters> {
  const res = await fetch("/api/policy/gates");
  return res.json();
}

export interface SimulateResult {
  decision: "ALLOW" | "ESCALATE" | "DENY";
  code: string;
  explanation: string;
  signals: { injection_detected: boolean; amount_anomalous: boolean };
  spent_window_hbar: number;
}

// POST /api/policy/simulate -- runs the REAL server-side evaluate(); never
// recorded, never settled. This is what makes /policy's simulator
// authoritative instead of a client-side port that could drift.
export async function simulatePolicy(service: string, amountHbar: number, merchantBody?: string): Promise<SimulateResult> {
  const res = await fetch("/api/policy/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ service, amount_hbar: amountHbar, merchant_body: merchantBody }),
  });
  return res.json();
}

export interface AppConfig {
  policy: {
    agent_id: string;
    max_tx_hbar: number;
    soft_limit_hbar: number;
    daily_budget_hbar: number;
    service_allowlist: string[];
  };
  accounts: {
    agentAccountId: string;
    merchantAccountId: string;
  };
}

// GET /api/config -- editable policy fields + account ids for the Settings section.
export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch("/api/config");
  return res.json();
}

export interface UpdatePolicyBody {
  max_tx_hbar?: number;
  soft_limit_hbar?: number;
  daily_budget_hbar?: number;
  service_allowlist?: string[];
}

export interface UpdatePolicyResult {
  ok: boolean;
  policy?: AppConfig["policy"] & Record<string, unknown>;
  error?: string;
  code?: string;
}

// PUT /api/policy -- persists edits to policy.json and hot-applies them.
export async function updatePolicy(body: UpdatePolicyBody): Promise<UpdatePolicyResult> {
  const res = await fetch("/api/policy", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
