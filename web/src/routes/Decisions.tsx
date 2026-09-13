import { useEffect, useMemo, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import type { RequestRow } from "../store/useAgentPayStore.js";
import { Sparkline } from "../components/Sparkline.js";
import { RequestDrawer } from "../components/RequestDrawer.js";
import { LoadingState } from "../components/LoadingState.js";
import { Money } from "../components/Money.js";

const DECISIONS: RequestRow["decision"][] = ["ALLOW", "ESCALATE", "DENY"];

const DECISION_STYLE: Record<RequestRow["decision"], string> = {
  ALLOW: "border-emerald-700 bg-emerald-950/40 text-emerald-400",
  ESCALATE: "border-amber-700 bg-amber-950/40 text-amber-400",
  DENY: "border-red-700 bg-red-950/40 text-red-400",
};

export function Decisions() {
  const connect = useAgentPayStore((s) => s.connect);
  const snapshot = useAgentPayStore((s) => s.snapshot);
  const [decisionFilter, setDecisionFilter] = useState<Set<RequestRow["decision"]>>(new Set());
  const [codeFilter, setCodeFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequestRow | null>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  const requests = snapshot?.recentRequests ?? [];

  const codes = useMemo(() => Array.from(new Set(requests.map((r) => r.decision_code))).sort(), [requests]);

  const filtered = useMemo(
    () =>
      requests.filter(
        (r) => (decisionFilter.size === 0 || decisionFilter.has(r.decision)) && (!codeFilter || r.decision_code === codeFilter)
      ),
    [requests, decisionFilter, codeFilter]
  );

  // Cumulative settled spend over the visible (unfiltered) requests, oldest
  // first, for the sparkline.
  const cumulativeSpend = useMemo(() => {
    let total = 0;
    return [...requests]
      .reverse()
      .map((r) => {
        if (r.settled) total += r.amount_hbar;
        return total;
      });
  }, [requests]);

  function toggleDecision(d: RequestRow["decision"]) {
    setDecisionFilter((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="bg-gradient-to-r from-white to-slate-400 bg-clip-text text-xl font-bold text-transparent">
          Decision Ledger
        </h1>
        <p className="text-sm text-slate-400">Every request the agent has made, with the reason it settled, escalated, or was refused.</p>
      </header>

      {!snapshot ? (
        <LoadingState />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Cumulative settled spend</p>
              <Sparkline values={cumulativeSpend} />
            </div>
            <div className="flex flex-wrap gap-2">
              {DECISIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => toggleDecision(d)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-opacity ${DECISION_STYLE[d]} ${
                    decisionFilter.size > 0 && !decisionFilter.has(d) ? "opacity-30" : ""
                  }`}
                >
                  {d}
                </button>
              ))}
              {codes.length > 0 && (
                <select
                  value={codeFilter ?? ""}
                  onChange={(e) => setCodeFilter(e.target.value || null)}
                  className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-xs text-slate-300"
                >
                  <option value="">All reason codes</option>
                  {codes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Service</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Decision</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Tx</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No requests match this filter.
                    </td>
                  </tr>
                )}
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer border-t border-slate-800 hover:bg-slate-900/60"
                  >
                    <td className="px-4 py-2 text-slate-500">{new Date(row.created_at).toLocaleTimeString()}</td>
                    <td className="px-4 py-2 font-mono text-slate-300">{row.service}</td>
                    <td className="px-4 py-2 text-slate-300">
                      <Money value={row.amount_hbar} suffix="" />
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[row.decision]}`}>
                        {row.decision}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{row.decision_code}</td>
                    <td className="px-4 py-2">
                      {row.tx_id ? (
                        <a
                          href={`https://hashscan.io/testnet/transaction/${row.tx_id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 underline hover:text-emerald-300"
                        >
                          view
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected && <RequestDrawer row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
