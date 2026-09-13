import { useEffect, useState } from "react";
import type { Snapshot } from "../store/useAgentPayStore.js";

export function PendingIntent({ state }: { state: Snapshot }) {
  const intent = state.pendingIntent;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!intent) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [intent]);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
      <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Pending Intent</h2>
      {!intent ? (
        <p className="mt-3 text-sm text-slate-500">Nothing awaiting approval.</p>
      ) : (
        <div className="mt-3 rounded-md border border-amber-600 bg-amber-950/40 p-3 text-sm text-amber-200">
          <div className="flex justify-between">
            <span className="font-semibold">{intent.service}</span>
            <span>{intent.amount_hbar.toFixed(4)} HBAR</span>
          </div>
          <p className="mt-1 text-xs opacity-80">{intent.reason}</p>
          <p className="mt-2 text-xs text-amber-400/70">
            Expires in {Math.max(0, Math.round((new Date(intent.expires_at).getTime() - now) / 1000))}s &middot;
            waiting for physical button
          </p>
        </div>
      )}
    </div>
  );
}
