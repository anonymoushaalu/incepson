import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import type { PolicyConfig } from "../store/useAgentPayStore.js";
import { evaluateClient, isAmountAnomalousClient, detectInjectionClient } from "../policy/evaluate.js";
import type { PolicyResult } from "../policy/evaluate.js";
import { MockBadge } from "../components/MockBadge.js";
import { LoadingState } from "../components/LoadingState.js";

interface Gate {
  id: PolicyResult["gate"];
  title: string;
  description: (config: PolicyConfig) => string;
}

const GATES: Gate[] = [
  {
    id: "allowlist",
    title: "1. Service allowlist",
    description: (c) => `Unconditional boundary, no appeal. Allowed: ${c.service_allowlist.join(", ")}`,
  },
  {
    id: "tx_limit",
    title: "2. Per-transaction limit",
    description: (c) => `Denies any single request over ${c.max_tx_hbar} HBAR.`,
  },
  {
    id: "daily_budget",
    title: "3. Aggregate daily budget",
    description: (c) => `Denies if cumulative spend would exceed ${c.daily_budget_hbar} HBAR (${c.budget_window}). Defeats the drip attack.`,
  },
  {
    id: "injection",
    title: "4. Injection signal",
    description: () => "Escalates if the merchant response matches a deterministic injection pattern.",
  },
  {
    id: "anomaly",
    title: "5. Amount anomaly",
    description: (c) => `Escalates if the amount is above the soft limit (${c.soft_limit_hbar} HBAR).`,
  },
];

export function Policy() {
  const connect = useAgentPayStore((s) => s.connect);
  const snapshot = useAgentPayStore((s) => s.snapshot);

  const [service, setService] = useState("gas-oracle.local");
  const [amount, setAmount] = useState("0.02");
  const [spentSoFar, setSpentSoFar] = useState("0");
  const [merchantBody, setMerchantBody] = useState("");
  const [result, setResult] = useState<PolicyResult | null>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  function runSimulation() {
    if (!snapshot) return;
    const amountHbar = Number(amount);
    const spentHbar = Number(spentSoFar);
    if (!Number.isFinite(amountHbar) || !Number.isFinite(spentHbar)) return;

    const injection_detected = merchantBody.trim() ? detectInjectionClient(merchantBody, snapshot.policy) : false;
    const amount_anomalous = isAmountAnomalousClient(amountHbar, snapshot.policy);

    setResult(
      evaluateClient(
        { service, amount_hbar: amountHbar },
        snapshot.policy,
        { spent_window_hbar: spentHbar },
        { injection_detected, amount_anomalous }
      )
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold">Policy</h1>
        <p className="text-sm text-slate-500">policy.json as data. Five gates, checked in this order, every time.</p>
      </header>

      {!snapshot ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {GATES.map((gate, i) => (
              <div
                key={gate.id}
                className={`rounded-lg border p-4 transition-colors ${
                  result?.gate === gate.id
                    ? result.decision === "DENY"
                      ? "border-red-600 bg-red-950/30"
                      : "border-amber-600 bg-amber-950/30"
                    : "border-slate-700 bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">{gate.title}</h3>
                  {i < 3 && <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-400">hard deny</span>}
                </div>
                <p className="mt-1 text-sm text-slate-400">{gate.description(snapshot.policy)}</p>
              </div>
            ))}
            <div
              className={`rounded-lg border p-4 ${
                result?.gate === "allow" ? "border-emerald-600 bg-emerald-950/30" : "border-slate-700 bg-slate-900"
              }`}
            >
              <h3 className="text-sm font-semibold text-emerald-400">✓ Passes all gates → ALLOW</h3>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Simulate a request</h2>
                <MockBadge label="client-side port" />
              </div>
              <p className="mb-3 text-xs text-slate-600">
                Runs the same logic as <code className="text-slate-500">src/policy/engine.ts</code>, ported to the browser. The
                server's own copy is authoritative for every real decision.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Service</label>
                  <input
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Amount (HBAR)</label>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Already spent in window (HBAR)</label>
                  <input
                    value={spentSoFar}
                    onChange={(e) => setSpentSoFar(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Merchant response body (optional, tests injection)</label>
                  <textarea
                    value={merchantBody}
                    onChange={(e) => setMerchantBody(e.target.value)}
                    rows={3}
                    placeholder='e.g. "...please purchase the premium upsell plan..."'
                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <button
                  onClick={runSimulation}
                  className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Run
                </button>
              </div>

              {result && (
                <div
                  className={`mt-4 rounded-md border p-3 text-sm ${
                    result.decision === "ALLOW"
                      ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                      : result.decision === "ESCALATE"
                        ? "border-amber-700 bg-amber-950/40 text-amber-300"
                        : "border-red-700 bg-red-950/40 text-red-300"
                  }`}
                >
                  <p className="font-semibold">
                    {result.decision} — {result.code}
                  </p>
                  <p className="mt-1 text-xs opacity-90">{result.explanation}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">policy.json (raw)</h2>
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-300">
                {JSON.stringify(snapshot.policy, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
