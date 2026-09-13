import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { runAgent, runScenario, resetDay, setDemoBudget } from "../store/api.js";
import type { RunAgentResult } from "../store/api.js";
import { MockBadge } from "../components/MockBadge.js";
import { GlowButton } from "../components/GlowButton.js";
import { Money } from "../components/Money.js";

interface ScenarioState {
  running: boolean;
  result: RunAgentResult | null;
  viaLlm: boolean;
}

const INITIAL: ScenarioState = { running: false, result: null, viaLlm: false };

export function Attacks() {
  const connect = useAgentPayStore((s) => s.connect);
  const snapshot = useAgentPayStore((s) => s.snapshot);
  const [injection, setInjection] = useState<ScenarioState>(INITIAL);
  const [drip, setDrip] = useState<ScenarioState>(INITIAL);
  const [dripRuns, setDripRuns] = useState(0);

  useEffect(() => {
    connect();
  }, [connect]);

  async function runInjection(viaLlm: boolean) {
    setInjection({ running: true, result: null, viaLlm });
    const result = viaLlm ? await runAgent({ scenario: "injection" }) : await runScenario("injection");
    setInjection({ running: false, result, viaLlm });
  }

  async function runDrip(viaLlm: boolean) {
    setDrip({ running: true, result: null, viaLlm });
    // See docs/RUNBOOK.md Phase 5: five 0.05 HBAR charges never cross the
    // real 0.30 daily_budget_hbar within five calls, so the demo shrinks
    // the effective window for this one scenario without touching
    // policy.json. Reset first so repeated runs on this page don't
    // accumulate spend from a previous attempt.
    await resetDay();
    await setDemoBudget(0.22);
    let last: RunAgentResult | null = null;
    for (let i = 0; i < 5; i++) {
      last = viaLlm ? await runAgent({ scenario: "drip" }) : await runScenario("drip");
      setDrip({ running: true, result: last, viaLlm });
      setDripRuns(i + 1);
    }
    setDrip({ running: false, result: last, viaLlm });
  }

  const budgetPct = snapshot ? Math.min(100, (snapshot.spentWindowHbar / snapshot.policy.daily_budget_hbar) * 100) : 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold">Attacks</h1>
        <p className="text-sm text-slate-500">
          The agent is not filtered from seeing either attack. It gets fooled and tries anyway — the policy engine refuses
          regardless of what the model was thinking. "No LLM" runs the exact same broker and settlement path with a fixed
          request instead of a live model call, for when the OpenAI account has no credits.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
          <h2 className="text-sm font-bold text-red-400">Prompt Injection</h2>
          <p className="mt-1 text-xs text-slate-500">
            <code className="text-slate-400">eth-price.local</code>'s response — including its <em>unpaid</em> 402 preview —
            carries a hidden instruction to buy from <code className="text-slate-400">premium-feed.example</code>. The
            allowlisted, in-budget first request actually <strong>escalates</strong> to a human on the injection signal; with
            nobody there to press the button, it safely times out after 60s. That is the real, correct behavior — not a bug.
          </p>
          <div className="mt-3 flex gap-2">
            <GlowButton tone="red" glow onClick={() => runInjection(true)} disabled={injection.running} className="flex-1">
              {injection.running && injection.viaLlm ? "Running..." : "Run via LLM"}
            </GlowButton>
            <button
              onClick={() => runInjection(false)}
              disabled={injection.running}
              className="flex-1 rounded-md border border-red-700 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-950/30 disabled:opacity-50"
            >
              {injection.running && !injection.viaLlm ? "Running... (up to 60s)" : "Run without LLM"}
            </button>
          </div>

          {injection.result?.error && (
            <div className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-400">
              <p className="font-semibold">Call failed: {injection.result.error}</p>
              <p className="mt-1 opacity-80">
                {injection.viaLlm
                  ? "Most likely the OpenAI account has no credits -- try \"Run without LLM\" instead."
                  : "This is a real failure from the broker/settlement path itself."}
              </p>
            </div>
          )}

          {injection.result?.transcript && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {injection.viaLlm ? "Agent transcript" : "Transcript"}
                </p>
                {!injection.viaLlm && <MockBadge label="no LLM" />}
              </div>
              {injection.result.transcript.map((line, i) => (
                <p
                  key={i}
                  className={`rounded-md border p-2 text-xs ${
                    line.includes("DENY")
                      ? "border-red-800 bg-red-950/30 text-red-300"
                      : line.includes("ESCALATE")
                        ? "border-amber-800 bg-amber-950/30 text-amber-300"
                        : "border-slate-700 bg-slate-950 text-slate-400"
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
          <h2 className="text-sm font-bold text-amber-400">Slow Drain (Drip)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Five individually-legal 0.05 HBAR refresh charges. Each one alone is fine — watch the aggregate budget stop the one
            that tips the total over.
          </p>
          <div className="mt-3 flex gap-2">
            <GlowButton tone="amber" glow onClick={() => runDrip(true)} disabled={drip.running} className="flex-1">
              {drip.running && drip.viaLlm ? `Running (${dripRuns}/5)...` : "Run via LLM (5 calls)"}
            </GlowButton>
            <button
              onClick={() => runDrip(false)}
              disabled={drip.running}
              className="flex-1 rounded-md border border-amber-700 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-950/30 disabled:opacity-50"
            >
              {drip.running && !drip.viaLlm ? `Running (${dripRuns}/5)...` : "Run without LLM"}
            </button>
          </div>

          {snapshot && (
            <div className="mt-3">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${budgetPct >= 100 ? "bg-red-500 shadow-[0_0_10px_theme(colors.red.500)]" : "bg-amber-500 shadow-[0_0_10px_theme(colors.amber.500)]"}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                <Money value={snapshot.spentWindowHbar} suffix="" /> / {snapshot.policy.daily_budget_hbar.toFixed(2)} HBAR
              </p>
            </div>
          )}

          {drip.result?.error && (
            <div className="mt-3 rounded-md border border-amber-800 bg-amber-950/30 p-3 text-xs text-amber-400">
              <p className="font-semibold">Call failed: {drip.result.error}</p>
              <p className="mt-1 opacity-80">
                {drip.viaLlm
                  ? "Most likely the OpenAI account has no credits -- try \"Run without LLM\" instead."
                  : "This is a real failure from the broker/settlement path itself."}
              </p>
            </div>
          )}

          {drip.result?.transcript && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {drip.viaLlm ? "Last call's transcript" : "Last call's transcript"}
                </p>
                {!drip.viaLlm && <MockBadge label="no LLM" />}
              </div>
              {drip.result.transcript.map((line, i) => (
                <p
                  key={i}
                  className={`rounded-md border p-2 text-xs ${
                    line.includes("DENY")
                      ? "border-red-800 bg-red-950/30 text-red-300"
                      : line.includes("ALLOW")
                        ? "border-emerald-800 bg-emerald-950/30 text-emerald-300"
                        : "border-slate-700 bg-slate-950 text-slate-400"
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-600">
        No transaction was created for either denied request. Verify on <a href="/chain" className="underline">On-Chain</a>.
      </p>
    </div>
  );
}
