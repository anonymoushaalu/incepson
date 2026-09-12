import type { RequestRow } from "../store/useAgentPayStore.js";

const DECISION_COLOR: Record<RequestRow["decision"], string> = {
  ALLOW: "text-emerald-400",
  ESCALATE: "text-amber-400",
  DENY: "text-red-400",
};

export function RequestDrawer({ row, onClose }: { row: RequestRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto border-l border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className={`text-lg font-bold ${DECISION_COLOR[row.decision]}`}>{row.decision}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">
            ✕
          </button>
        </div>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Service</dt>
            <dd className="font-mono text-slate-200">{row.service}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Amount</dt>
            <dd className="text-slate-200">{row.amount_hbar.toFixed(8)} HBAR</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Decision code</dt>
            <dd className="font-mono text-slate-200">{row.decision_code}</dd>
          </div>
          {row.reason && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Agent's stated reason</dt>
              <dd className="text-slate-400 italic">"{row.reason}" (untrusted, display only)</dd>
            </div>
          )}
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Settled</dt>
            <dd className="text-slate-200">{row.settled ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Timestamp</dt>
            <dd className="text-slate-200">{new Date(row.created_at).toLocaleString()}</dd>
          </div>
          {row.tx_id && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Transaction</dt>
              <dd>
                <a
                  className="break-all text-emerald-400 underline hover:text-emerald-300"
                  href={`https://hashscan.io/testnet/transaction/${row.tx_id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.tx_id}
                </a>
              </dd>
            </div>
          )}
        </dl>

        {row.decision === "DENY" && (
          <p className="mt-6 rounded-md border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-400">
            No transaction was created for this request. Settlement code was never reached.
          </p>
        )}
      </div>
    </div>
  );
}
