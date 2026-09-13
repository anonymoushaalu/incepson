import { useEffect, useState } from "react";
import { fetchConfig, updatePolicy } from "../store/api.js";
import type { AppConfig } from "../store/api.js";
import { GlowButton } from "../components/GlowButton.js";
import { LoadingState } from "../components/LoadingState.js";
import { MockBadge } from "../components/MockBadge.js";

/**
 * Editable policy limits + read-only account info. Writes go through the
 * real PUT /api/policy -- there is no local-only "preview" state here: what
 * you save is what src/policy/engine.ts evaluates against on the very next
 * request, immediately, no restart. Account ids are read-only because this
 * demo has exactly one agent account and one merchant account configured
 * via .env; switching accounts would mean re-keying Hedera credentials, not
 * a UI toggle.
 */
export function Settings() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [maxTx, setMaxTx] = useState("");
  const [softLimit, setSoftLimit] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [allowlist, setAllowlist] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyConfig(c: AppConfig) {
    setConfig(c);
    setMaxTx(String(c.policy.max_tx_hbar));
    setSoftLimit(String(c.policy.soft_limit_hbar));
    setDailyBudget(String(c.policy.daily_budget_hbar));
    setAllowlist(c.policy.service_allowlist.join(", "));
  }

  useEffect(() => {
    fetchConfig().then(applyConfig);
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updatePolicy({
        max_tx_hbar: Number(maxTx),
        soft_limit_hbar: Number(softLimit),
        daily_budget_hbar: Number(dailyBudget),
        service_allowlist: allowlist
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      if (!result.ok) {
        setError(result.error ?? "Save failed.");
        return;
      }
      const refreshed = await fetchConfig();
      applyConfig(refreshed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <LoadingState label="Loading configuration..." />;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">
          Edit the live policy limits. Every change here writes to <code className="text-slate-500">policy.json</code> and
          takes effect on the next request -- no restart, no redeploy.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
          <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">Policy limits</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">Per-transaction limit (HBAR)</label>
              <input
                value={maxTx}
                onChange={(e) => setMaxTx(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Soft limit / anomaly threshold (HBAR)</label>
              <input
                value={softLimit}
                onChange={(e) => setSoftLimit(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Daily budget, rolling 24h (HBAR)</label>
              <input
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm text-slate-200 focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-500">Service allowlist (comma-separated)</label>
              <input
                value={allowlist}
                onChange={(e) => setAllowlist(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-mono text-slate-200 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <GlowButton tone="brand" glow onClick={handleSave} disabled={saving} className="w-full">
              {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
            </GlowButton>

            {error && (
              <p className="rounded-md border border-red-800 bg-red-950/30 px-3 py-2 text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
            <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">Accounts</h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">Agent account (this app's signer)</p>
                <p className="font-mono text-slate-200">{config.accounts.agentAccountId || "not configured"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Merchant account (settlement recipient)</p>
                <p className="font-mono text-slate-200">{config.accounts.merchantAccountId || "not configured"}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <MockBadge label="read-only" />
              Set via HEDERA_ACCOUNT_ID / MERCHANT_ACCOUNT_ID in .env -- this demo runs one agent and one merchant, so
              there is nothing to switch between.
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
            <h2 className="mb-2 text-sm font-medium text-slate-400 uppercase tracking-wide">Agent id</h2>
            <p className="font-mono text-sm text-slate-200">{config.policy.agent_id}</p>
            <p className="mt-2 text-xs text-slate-600">
              Identifies this policy's owner in the ledger. Not editable from here -- it's a deployment-time identity, not
              a runtime limit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
