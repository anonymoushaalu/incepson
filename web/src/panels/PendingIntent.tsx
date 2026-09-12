import type { Snapshot } from "../useAgentPay";

/**
 * Phase 4 wires this to a real pending intent (device poll target). Until
 * then it shows the most recent ESCALATE row as a placeholder so the panel
 * layout is complete and demonstrable ahead of the device existing.
 */
export function PendingIntent({ state }: { state: Snapshot }) {
  const pending = state.recentRequests.find((r) => r.decision === "ESCALATE");

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Pending Intent</h2>
      {!pending ? (
        <p className="mt-3 text-sm text-slate-500">Nothing awaiting approval.</p>
      ) : (
        <div className="mt-3 rounded-md border border-amber-600 bg-amber-950/40 p-3 text-sm text-amber-200">
          <div className="flex justify-between">
            <span className="font-semibold">{pending.service}</span>
            <span>{pending.amount_hbar.toFixed(4)} HBAR</span>
          </div>
          <p className="mt-1 text-xs opacity-80">{pending.decision_code}</p>
          <p className="mt-2 text-xs text-amber-400/70">Waiting for physical button approval (Phase 4)</p>
        </div>
      )}
    </div>
  );
}
