import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { runAgent, resetDay } from "../store/api.js";
import { BudgetPanel } from "../components/BudgetPanel.js";
import { DecisionFeed } from "../components/DecisionFeed.js";
import { PendingIntent } from "../components/PendingIntent.js";
import { PolicyPanel } from "../components/PolicyPanel.js";

/**
 * `/` -- the hero page. A1: DOM panels only (migrated from the old App.tsx).
 * A3-A5 replace the panel grid below with the 3D flow scene; these panels
 * become the WebGL-unavailable fallback per docs/FRONTEND_PLAN.md.
 */
export function LiveFlow() {
  const connect = useAgentPayStore((s) => s.connect);
  const state = useAgentPayStore((s) => s.snapshot);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  async function handleRunAgent() {
    setRunning(true);
    try {
      await runAgent({});
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Live Flow</h1>
          <p className="text-sm text-slate-500">Autonomous spend, policy-enforced.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => resetDay()}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Reset day
          </button>
          <button
            onClick={handleRunAgent}
            disabled={running || !state}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {running ? "Running..." : "Run agent task"}
          </button>
        </div>
      </header>

      {!state ? (
        <p className="text-slate-500">Connecting...</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BudgetPanel state={state} />
          <PendingIntent state={state} />
          <DecisionFeed state={state} />
          <PolicyPanel state={state} />
        </div>
      )}
    </div>
  );
}
