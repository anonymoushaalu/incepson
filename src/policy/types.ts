export type Decision = "ALLOW" | "ESCALATE" | "DENY";

export interface PolicyConfig {
  agent_id: string;
  max_tx_hbar: number;
  soft_limit_hbar: number;
  daily_budget_hbar: number;
  budget_window: "rolling_24h";
  p95_min_sample: number;
  service_allowlist: string[];
  escalate_on: string[];
  escalation_timeout_sec: number;
  injection_patterns: string[];
}

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
  reason: string; // agent-supplied, UNTRUSTED, display only
}

export interface PolicyResult {
  decision: Decision;
  code: string; // machine-readable reason, shown on the dashboard
  explanation: string; // human-readable, shown on the dashboard
}
