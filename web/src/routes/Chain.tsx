import { useEffect, useState } from "react";
import { useAgentPayStore } from "../store/useAgentPayStore.js";
import { fetchChainBalances, fetchChainTransactions } from "../store/api.js";
import type { ChainBalances } from "../store/api.js";
import { LoadingState } from "../components/LoadingState.js";

interface ChainTransaction {
  tx_id: string;
  amount_hbar: number;
  service: string;
  created_at: string;
  hashscan_url: string;
}

/**
 * Real data throughout: settled transactions come from GET
 * /api/chain/transactions, balances from GET /api/chain/balances (a live
 * Hedera mirror-node lookup, cached server-side 15s). Both landed in Part B
 * -- this page no longer has a mocked section.
 */
export function Chain() {
  const connect = useAgentPayStore((s) => s.connect);
  const snapshot = useAgentPayStore((s) => s.snapshot);
  const [balances, setBalances] = useState<ChainBalances | null>(null);
  const [transactions, setTransactions] = useState<ChainTransaction[] | null>(null);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    fetchChainBalances().then(setBalances);
    fetchChainTransactions().then(setTransactions);
  }, [snapshot?.recentRequests.length]); // refetch after each new decision

  const denied = (snapshot?.recentRequests ?? []).filter((r) => r.decision === "DENY");

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-bold">On-Chain</h1>
        <p className="text-sm text-slate-500">Settled transactions and the absence of transactions where none should exist.</p>
      </header>

      {!snapshot ? (
        <LoadingState />
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
            <h2 className="mb-2 text-sm font-medium text-slate-400 uppercase tracking-wide">Account balances</h2>
            {balances ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Agent ({balances.agentAccountId || "not configured"})</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {balances.agentBalanceHbar != null ? `${balances.agentBalanceHbar.toFixed(2)} HBAR` : "unavailable"}
                  </p>
                  {balances.agentBalanceHbar != null && balances.hbarUsd != null && (
                    <p className="text-xs text-slate-500">≈ ${(balances.agentBalanceHbar * balances.hbarUsd).toFixed(2)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Merchant ({balances.merchantAccountId || "not configured"})</p>
                  <p className="text-lg font-semibold text-slate-100">
                    {balances.merchantBalanceHbar != null ? `${balances.merchantBalanceHbar.toFixed(2)} HBAR` : "unavailable"}
                  </p>
                  {balances.merchantBalanceHbar != null && balances.hbarUsd != null && (
                    <p className="text-xs text-slate-500">≈ ${(balances.merchantBalanceHbar * balances.hbarUsd).toFixed(2)}</p>
                  )}
                </div>
              </div>
            ) : (
              <LoadingState label="Fetching balances from the Hedera mirror node..." />
            )}
            <p className="mt-2 text-xs text-slate-600">
              Balances live from{" "}
              <code className="rounded bg-slate-950 px-1 py-0.5">testnet.mirrornode.hedera.com</code>, cached 15s server-side.
              {balances?.hbarUsd != null && (
                <>
                  {" "}
                  USD conversion at ${balances.hbarUsd.toFixed(4)}/HBAR, live from{" "}
                  <a
                    href="https://data.chain.link/feeds/hedera/hedera/hbar-usd"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-slate-400"
                  >
                    Chainlink's HBAR/USD feed on Hedera testnet
                  </a>
                  , cached 30s server-side.
                </>
              )}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-4 backdrop-blur">
            <h2 className="mb-3 text-sm font-medium text-slate-400 uppercase tracking-wide">
              Settled transactions ({transactions?.length ?? 0})
            </h2>
            {!transactions ? (
              <LoadingState label="Loading transactions..." />
            ) : transactions.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing has settled yet.</p>
            ) : (
              <ul className="space-y-2">
                {transactions.map((r) => (
                  <li
                    key={r.tx_id}
                    className="flex items-center justify-between rounded-md border border-slate-800 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-mono text-slate-300">{r.service}</span>
                      <span className="ml-2 text-slate-500">{r.amount_hbar.toFixed(4)} HBAR</span>
                    </div>
                    <a
                      href={r.hashscan_url}
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
