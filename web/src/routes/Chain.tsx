import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { fetchChainBalances } from "../store/api.js";
import type { ChainBalances } from "../store/mock.js";
import { MockBadge } from "../components/MockBadge.js";

/**
 * Settled transactions are derived from the real SSE snapshot's
 * recentRequests (every row that has a tx_id) -- not mocked, since the
 * backend already carries this data. Only account balances are mocked: a
 * real balance fetch needs a Hedera mirror-node call Part B has not added
 * yet (GET /api/chain/balances, see docs/FRONTEND_PLAN.md).
 */
export function Chain() {
  const connect = useAgentPayStore((s) => s.connect);
  const snapshot = useAgentPayStore((s) => s.snapshot);
  const [balances, setBalances] = useState<ChainBalances | null>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    fetchChainBalances().then(setBalances);
  }, []);

  const requests = snapshot?.recentRequests ?? [];
  const settled = requests.filter((r) => r.tx_id);
  const denied = requests.filter((r) => r.decision === "DENY");

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold">On-Chain</h1>
        <p className="text-sm text-slate-500">Settled transactions and the absence of transactions where none should exist.</p>
      </header>

      {!snapshot ? (
        <p className="text-slate-500">Connecting...</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wide">Account balances</h2>
              <MockBadge />
            </div>
            {balances ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Agent ({balances.agentAccountId})</p>
                  <p className="text-lg font-semibold text-slate-100">{balances.agentBalanceHbar.toFixed(2)} HBAR</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Merchant ({balances.merchantAccountId})</p>
                  <p className="text-lg font-semibold text-slate-100">{balances.merchantBalanceHbar.toFixed(2)} HBAR</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Not wired to the Hedera mirror node yet — check the account balances directly:
              </p>
            )}
            <p className="mt-2 text-xs text-slate-600">
              Verify manually:{" "}
              <code className="rounded bg-slate-950 px-1 py-0.5">
                curl https://testnet.mirrornode.hedera.com/api/v1/accounts/&lt;id&gt;
              </code>
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">
              Settled transactions ({settled.length})
            </h2>
            {settled.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing has settled yet.</p>
            ) : (
              <ul className="space-y-2">
                {settled.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 text-sm">
                    <div>
                      <span className="font-mono text-slate-300">{r.service}</span>
                      <span className="ml-2 text-slate-500">{r.amount_hbar.toFixed(4)} HBAR</span>
                    </div>
                    <a
                      href={`https://hashscan.io/testnet/transaction/${r.tx_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline hover:text-emerald-300"
                    >
                      HashScan →
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-red-900 bg-red-950/20 p-4">
            <h2 className="mb-2 text-sm font-medium text-red-400 uppercase tracking-wide">
              Absence of transactions ({denied.length} denied)
            </h2>
            <p className="text-sm text-slate-400">
              For every denied request, no Hedera transaction was ever created — settlement code was never reached. This is the
              result the injection and drip scenarios demonstrate: not a log line saying "denied," but a real ledger with nothing
              in it.
            </p>
            {denied.length > 0 && (
              <p className="mt-2 font-mono text-xs text-slate-600">
                {denied.filter((r) => r.settled || r.tx_id).length === 0
                  ? "Verified: zero denied rows have a settlement or transaction id."
                  : "WARNING: a denied row has a transaction id -- this should never happen."}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
