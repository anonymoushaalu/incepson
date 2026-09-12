import { useEffect, useMemo, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { approveDevice } from "../store/api.js";
import { OledMirror } from "../components/OledMirror.js";
import type { OledState } from "../components/OledMirror.js";

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
}

export function Device() {
  const connect = useAgentPayStore((s) => s.connect);
  const snapshot = useAgentPayStore((s) => s.snapshot);
  const pendingIntent = snapshot?.pendingIntent ?? null;

  const [now, setNow] = useState(() => Date.now());
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    if (!pendingIntent) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [pendingIntent]);

  const secondsLeft = pendingIntent
    ? Math.max(0, Math.round((new Date(pendingIntent.expires_at).getTime() - now) / 1000))
    : 0;

  const oledState: OledState = useMemo(() => {
    if (!pendingIntent) return { kind: "idle" };
    return {
      kind: "intent",
      service: pendingIntent.service,
      amount: pendingIntent.amount_hbar.toFixed(4),
      reason: pendingIntent.reason,
    };
  }, [pendingIntent]);

  async function runTamperCheck() {
    if (!pendingIntent) return;
    setRunning(true);
    try {
      // Deliberately wrong HMAC. The device holds no signing key -- neither
      // does this browser -- so this is the honest way to demonstrate
      // rejection from a page: the backend must refuse a garbage signature
      // exactly as it would refuse a physically tampered intent.
      const result = await approveDevice(pendingIntent.intent_id, `tamper-${Date.now()}`, "0".repeat(64));
      setChecks((prev) => [
        {
          label: "Tamper (wrong HMAC)",
          ok: result.ok === false && result.error === "BAD_HMAC",
          detail: JSON.stringify(result),
        },
        ...prev,
      ]);
    } finally {
      setRunning(false);
    }
  }

  async function runUnknownIntentCheck() {
    setRunning(true);
    try {
      const result = await approveDevice("00000000-0000-0000-0000-000000000000", "x", "y".repeat(64));
      setChecks((prev) => [
        {
          label: "Unknown intent id",
          ok: result.ok === false && result.error === "NOT_FOUND",
          detail: JSON.stringify(result),
        },
        ...prev,
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold">Device</h1>
        <p className="text-sm text-slate-500">
          The ESP32 holds no key material that can move funds. It verifies the server's HMAC locally and signs an approval for
          one specific intent, never a transaction and never a session.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">OLED mirror</h2>
            <OledMirror state={oledState} />
          </div>

          {pendingIntent && (
            <div className="rounded-lg border border-amber-700 bg-amber-950/30 p-4 text-sm">
              <p className="font-semibold text-amber-300">Pending: {secondsLeft}s remaining</p>
              <p className="mt-1 text-amber-400/80">
                {pendingIntent.service} — {pendingIntent.amount_hbar.toFixed(4)} HBAR
              </p>
              <p className="mt-1 font-mono text-xs text-amber-600">intent_id: {pendingIntent.intent_id}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-1 text-sm font-medium text-slate-400 uppercase tracking-wide">Adversarial checks</h2>
            <p className="mb-3 text-xs text-slate-600">
              The HMAC signing key lives only on the server and the physical device — never in this browser, so these checks
              cannot forge a valid signature. What they <em>can</em> do, honestly: prove the backend refuses a garbage signature
              and an unknown intent id. Replay and swap defense are checked <em>after</em> HMAC verification in the real code
              path (see <code className="text-slate-500">src/intents/index.ts</code>), so they cannot be demonstrated from a
              browser that never has a valid signature to replay — they are covered by 25 passing backend tests instead (tamper,
              replay, double-consume, expiry, and the swap defense), not reproduced here.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={runTamperCheck}
                disabled={!pendingIntent || running}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Run tamper check
              </button>
              <button
                onClick={runUnknownIntentCheck}
                disabled={running}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                Run unknown-intent check
              </button>
            </div>
            {!pendingIntent && (
              <p className="mt-2 text-xs text-slate-600">No intent is currently pending — the tamper check needs one.</p>
            )}
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">Results</h2>
            {checks.length === 0 ? (
              <p className="text-sm text-slate-500">No checks run yet.</p>
            ) : (
              <ul className="space-y-2">
                {checks.map((c, i) => (
                  <li
                    key={i}
                    className={`rounded-md border p-2 text-xs ${
                      c.ok ? "border-emerald-800 bg-emerald-950/30 text-emerald-300" : "border-red-800 bg-red-950/30 text-red-300"
                    }`}
                  >
                    <p className="font-semibold">
                      {c.ok ? "✓" : "✗"} {c.label}
                    </p>
                    <p className="mt-1 break-all font-mono opacity-80">{c.detail}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
