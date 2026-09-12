import { useEffect, useState } from "react";

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

export interface Snapshot {
  policy: PolicyConfig;
  spentWindowHbar: number;
  remainingHbar: number;
  recentRequests: RequestRow[];
}

type DecisionEvent = {
  type: "decision";
  requestId: string;
  service: string;
  amountHbar: number;
  decision: string;
  code: string;
  explanation: string;
  txId?: string;
};

/** Single hook: snapshot on mount, then patched live from SSE. */
export function useAgentPay() {
  const [state, setState] = useState<Snapshot | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/stream");

    source.addEventListener("snapshot", (ev) => {
      setState(JSON.parse((ev as MessageEvent).data));
    });

    source.addEventListener("decision", (ev) => {
      const decision = JSON.parse((ev as MessageEvent).data) as DecisionEvent;
      setState((prev) => {
        if (!prev) return prev;
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
        return {
          ...prev,
          spentWindowHbar,
          remainingHbar: prev.policy.daily_budget_hbar - spentWindowHbar,
          recentRequests: [row, ...prev.recentRequests].slice(0, 50),
        };
      });
    });

    source.addEventListener("budget_reset", () => {
      fetch("/api/state")
        .then((r) => r.json())
        .then(setState);
    });

    return () => source.close();
  }, []);

  return state;
}
