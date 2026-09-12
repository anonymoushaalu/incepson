import type { Snapshot } from "../useAgentPay";

/** Renders policy.json read-only: "policy is data, not code" made visible, not claimed. */
export function PolicyPanel({ state }: { state: Snapshot }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">policy.json</h2>
      <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-300">
        {JSON.stringify(state.policy, null, 2)}
      </pre>
    </div>
  );
}
