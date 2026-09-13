import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { runAgent, runScenario, resetDay } from "../store/api.js";
import type { RunAgentResult } from "../store/api.js";
import { BudgetPanel } from "../components/BudgetPanel.js";
import { DecisionFeed } from "../components/DecisionFeed.js";
import { PendingIntent } from "../components/PendingIntent.js";
import { PolicyPanel } from "../components/PolicyPanel.js";
import { FlowScene } from "../scene/FlowScene.js";
import { useWebglSupported } from "../scene/useWebglSupported.js";
import { LoadingState } from "../components/LoadingState.js";
import { GlowButton } from "../components/GlowButton.js";
import { MockBadge } from "../components/MockBadge.js";

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
  const [demoRunning, setDemoRunning] = useState<"pass" | "fail" | null>(null);
  const [demoResult, setDemoResult] = useState<RunAgentResult | null>(null);

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

  // Guaranteed one-click pass and fail cases for a live demo: both go
  // through the exact same broker/policy/settlement path as everything
  // else on this page (no LLM, no mocked outcome) -- "autonomous" is
  // allowlisted and in-budget so it always settles for real on Hedera;
  // "denied" targets a service that is never on the allowlist, so it always
  // returns an immediate DENY with zero network activity. Neither depends
  // on OpenAI credits or a 60s escalation wait.
  async function handleRunDemo(kind: "pass" | "fail") {
    setDemoRunning(kind);
    setDemoResult(null);
    try {
      const result = await runScenario(kind === "pass" ? "autonomous" : "denied");
      setDemoResult(result);
    } finally {
      setDemoRunning(null);
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
