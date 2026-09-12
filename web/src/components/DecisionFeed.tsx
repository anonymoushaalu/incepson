import type { Snapshot, RequestRow } from "../store/useAgentPayStore.js";

const COLORS: Record<RequestRow["decision"], string> = {
  ALLOW: "border-emerald-600 bg-emerald-950/40 text-emerald-300",
  ESCALATE: "border-amber-600 bg-amber-950/40 text-amber-300",
  DENY: "border-red-600 bg-red-950/40 text-red-300",
};

export function DecisionFeed({ state }: { state: Snapshot }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Decision Feed</h2>
      <div className="mt-3 flex flex-col gap-2 max-h-96 overflow-y-auto">
        {state.recentRequests.length === 0 && (
          <p className="text-sm text-slate-500">No requests yet.</p>
        )}
        {state.recentRequests.map((row) => (
          <div key={row.id} className={`rounded-md border px-3 py-2 text-sm ${COLORS[row.decision]}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{row.decision}</span>
              <span className="font-mono text-xs opacity-80">{row.decision_code}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs opacity-90">
              <span>{row.service}</span>
              <span>{row.amount_hbar.toFixed(4)} HBAR</span>
            </div>
            {row.tx_id && (
              <a
                className="mt-1 block truncate text-xs underline opacity-70 hover:opacity-100"
                href={`https://hashscan.io/testnet/transaction/${row.tx_id}`}
                target="_blank"
                rel="noreferrer"
              >
                {row.tx_id}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
