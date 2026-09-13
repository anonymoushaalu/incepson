import type { Snapshot } from "../store/useAgentPayStore.js";
import { Money } from "./Money.js";

export function BudgetPanel({ state }: { state: Snapshot }) {
  const pct = Math.min(100, (state.spentWindowHbar / state.policy.daily_budget_hbar) * 100);
  const over = state.remainingHbar < 0;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
      <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Daily Budget</h2>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-100">
          <Money value={state.spentWindowHbar} suffix="" />
        </span>
        <span className="text-slate-500">/ {state.policy.daily_budget_hbar.toFixed(2)} HBAR</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-500 ${over ? "bg-red-500 shadow-[0_0_10px_theme(colors.red.500)]" : pct > 80 ? "bg-amber-500 shadow-[0_0_10px_theme(colors.amber.500)]" : "bg-emerald-500 shadow-[0_0_10px_theme(colors.emerald.500)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {over ? "Over budget" : <>{<Money value={state.remainingHbar} suffix=" HBAR remaining" />}</>} &middot; rolling
        24h window
      </p>
    </div>
  );
}
