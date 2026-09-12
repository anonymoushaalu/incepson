import type { Snapshot } from "../useAgentPay";

export function BudgetPanel({ state }: { state: Snapshot }) {
  const pct = Math.min(100, (state.spentWindowHbar / state.policy.daily_budget_hbar) * 100);
  const over = state.remainingHbar < 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Daily Budget</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-100">{state.spentWindowHbar.toFixed(4)}</span>
        <span className="text-slate-500">/ {state.policy.daily_budget_hbar.toFixed(2)} HBAR</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {over ? "Over budget" : `${state.remainingHbar.toFixed(4)} HBAR remaining`} &middot; rolling 24h window
      </p>
    </div>
  );
}
