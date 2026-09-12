import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { runAgent, resetDay } from "../store/api.js";
import { BudgetPanel } from "../components/BudgetPanel.js";
import { DecisionFeed } from "../components/DecisionFeed.js";
import { PendingIntent } from "../components/PendingIntent.js";
import { PolicyPanel } from "../components/PolicyPanel.js";
import { FlowScene } from "../scene/FlowScene.js";
import { useWebglSupported } from "../scene/useWebglSupported.js";
import { LoadingState } from "../components/LoadingState.js";

/**
 * `/` -- the hero page. The 3D enforcement-graph scene renders when WebGL is
 * available; the original panel grid is the fallback per docs/FRONTEND_PLAN.md
 * ("Degrades: if WebGL is unavailable, render the DOM fallback panel set").
 * The panel grid always renders below the scene too, since it's the more
 * data-dense view a technical judge may still want alongside the visual.
 */
export function LiveFlow() {
  const webglSupported = useWebglSupported();
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
        <LoadingState />
      ) : (
        <>
          {webglSupported === false && (
            <p className="mb-4 rounded-md border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs text-amber-400">
              WebGL is unavailable in this browser — showing the data panels only.
            </p>
          )}
          {webglSupported !== false && (
            <div className="mb-4">
              <FlowScene />
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <BudgetPanel state={state} />
            <PendingIntent state={state} />
            <DecisionFeed state={state} />
            <PolicyPanel state={state} />
          </div>
        </>
      )}
    </div>
  );
}
