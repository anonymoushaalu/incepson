import { create } from "zustand";

export interface PolicyConfig {
  agent_id: string;
  max_tx_hbar: number;
  soft_limit_hbar: number;
  daily_budget_hbar: number;
  budget_window: string;
  p95_min_sample: number;
  service_allowlist: string[];
  escalate_on: string[];
  escalation_timeout_sec: number;
  injection_patterns: string[];
}

export interface RequestRow {
  id: string;
  created_at: string;
  service: string;
  amount_hbar: number;
  reason: string | null;
  decision: "ALLOW" | "ESCALATE" | "DENY";
  decision_code: string;
  settled: number;
  tx_id: string | null;
}

export interface IntentRow {
  intent_id: string;
  service: string;
  recipient: string;
  amount_hbar: number;
  reason: string;
  expires_at: string;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "CONSUMED";
}

export interface IntentHistoryRow {
  intent_id: string;
  request_id: string;
  service: string;
  recipient: string;
  amount_hbar: number;
  reason: string;
  expires_at: string;
  hmac: string;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "CONSUMED";
  consumed_at: string | null;
}

export interface GateCounts {
  allowlist: number;
  tx_limit: number;
  daily_budget: number;
  injection: number;
  anomaly: number;
  allow: number;
}

export interface Snapshot {
  policy: PolicyConfig;
  spentWindowHbar: number;
  remainingHbar: number;
  recentRequests: RequestRow[];
  pendingIntent: IntentRow | null;
  /** Added in Part B (B3): a cold page load needs one request instead of
   *  six -- these used to each need their own endpoint fetch on mount. */
  intentHistory: IntentHistoryRow[];
  gateCounts: GateCounts;
}

export type DecisionEvent = {
  type: "decision";
  requestId: string;
  service: string;
  amountHbar: number;
  decision: string;
  code: string;
  explanation: string;
  txId?: string;
};

interface AgentPayState {
  snapshot: Snapshot | null;
  connected: boolean;
  /** The last decision event, for scene code that wants to react to it once
   *  (spawn a packet) rather than derive it from a diff of recentRequests. */
  lastDecision: DecisionEvent | null;
  /** Bumped on every decision event, even repeats with identical payloads
   *  (e.g. two DENYs in a row for the same service/amount). Consumers that
   *  need to fire exactly once per real event (spawning a 3D packet) should
   *  diff this, not lastDecision itself -- object identity alone survives a
   *  JSON round-trip fine, but two decisions can be deep-equal and still be
   *  two distinct events that must each spawn their own packet. */
  decisionSeq: number;
}

interface AgentPayActions {
  /** Idempotent: safe to call from every page that needs the data. Only the
   *  first call actually opens the EventSource -- this is what makes "one
   *  SSE connection for the whole app" a guarantee rather than a convention. */
  connect: () => void;
}

let source: EventSource | null = null;

export const useAgentPayStore = create<AgentPayState & AgentPayActions>((set, get) => ({
  snapshot: null,
  connected: false,
  lastDecision: null,
  decisionSeq: 0,

  connect: () => {
    if (source) return;

    source = new EventSource("/api/stream");

    source.addEventListener("open", () => set({ connected: true }));
    source.addEventListener("error", () => set({ connected: false }));

    source.addEventListener("snapshot", (ev) => {
      set({ snapshot: JSON.parse((ev as MessageEvent).data), connected: true });
    });

    source.addEventListener("decision", (ev) => {
      const decision = JSON.parse((ev as MessageEvent).data) as DecisionEvent;
      const prev = get().snapshot;
      if (!prev) {
        set((state) => ({ lastDecision: decision, decisionSeq: state.decisionSeq + 1 }));
        return;
      }
      const row: RequestRow = {
        id: decision.requestId,
        created_at: new Date().toISOString(),
        service: decision.service,
        amount_hbar: decision.amountHbar,
        reason: null,
        decision: decision.decision as RequestRow["decision"],
        decision_code: decision.code,
        settled: decision.decision === "ALLOW" ? 1 : 0,
        tx_id: decision.txId ?? null,
      };
      const spentWindowHbar =
        decision.decision === "ALLOW" ? prev.spentWindowHbar + decision.amountHbar : prev.spentWindowHbar;
      set((state) => ({
        lastDecision: decision,
        decisionSeq: state.decisionSeq + 1,
        snapshot: {
          ...prev,
          spentWindowHbar,
          remainingHbar: prev.policy.daily_budget_hbar - spentWindowHbar,
          recentRequests: [row, ...prev.recentRequests].slice(0, 50),
        },
      }));
    });

    source.addEventListener("budget_reset", () => {
      fetch("/api/state")
        .then((r) => r.json())
        .then((snapshot) => set({ snapshot }));
    });

    source.addEventListener("intent_pending", (ev) => {
      const { intent } = JSON.parse((ev as MessageEvent).data) as { intent: IntentRow };
      set((state) => (state.snapshot ? { snapshot: { ...state.snapshot, pendingIntent: intent } } : {}));
    });

    source.addEventListener("intent_timeout", () => {
      set((state) => (state.snapshot ? { snapshot: { ...state.snapshot, pendingIntent: null } } : {}));
    });

    source.addEventListener("intent_resolved", () => {
      set((state) => (state.snapshot ? { snapshot: { ...state.snapshot, pendingIntent: null } } : {}));
    });
  },
}));
