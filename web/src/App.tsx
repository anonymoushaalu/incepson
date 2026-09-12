import { useState } from "react";
import { useAgentPay } from "./useAgentPay";
import { BudgetPanel } from "./panels/BudgetPanel";
import { DecisionFeed } from "./panels/DecisionFeed";
import { PendingIntent } from "./panels/PendingIntent";
import { PolicyPanel } from "./panels/PolicyPanel";

function App() {
  const state = useAgentPay();
  const [running, setRunning] = useState(false);

  async function runAgent() {
    setRunning(true);
    try {
      await fetch("/api/agent/run", { method: "POST" });
    } finally {
      setRunning(false);
    }
  }

  async function resetDay() {
    await fetch("/api/dev/reset-day", { method: "POST" });
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">AgentPay</h1>
          <p className="text-sm text-slate-500">Autonomous spend, policy-enforced.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={resetDay}
            className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Reset day
          </button>
          <button
            onClick={runAgent}
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

export default App;
