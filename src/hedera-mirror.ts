// Read-only Hedera testnet mirror-node client. No SDK needed for this --
// it's a plain public REST GET, the same one used manually throughout
// development (see docs/RUNBOOK.md's verification curls).
import { env } from "./config.js";

const MIRROR_BASE = "https://testnet.mirrornode.hedera.com/api/v1";

interface MirrorAccountResponse {
  balance?: { balance: number }; // tinybar
}

/** Returns the account's HBAR balance, or null if the lookup fails (network
 *  error, unknown account, mirror node down) -- callers show "unavailable"
 *  rather than crash the page that asked for it. */
export async function fetchAccountBalanceHbar(accountId: string): Promise<number | null> {
  if (!accountId) return null;
  try {
    const res = await fetch(`${MIRROR_BASE}/accounts/${accountId}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = (await res.json()) as MirrorAccountResponse;
    const tinybar = body.balance?.balance;
    return typeof tinybar === "number" ? tinybar / 1e8 : null;
  } catch {
    return null;
  }
}

export interface ChainBalances {
  agentAccountId: string;
  agentBalanceHbar: number | null;
  merchantAccountId: string;
  merchantBalanceHbar: number | null;
}

let cached: { at: number; value: ChainBalances } | null = null;
const CACHE_MS = 15_000; // mirror node balances don't need per-request freshness

export async function getChainBalances(): Promise<ChainBalances> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  const [agentBalanceHbar, merchantBalanceHbar] = await Promise.all([
    fetchAccountBalanceHbar(env.hederaAccountId),
    fetchAccountBalanceHbar(env.merchantAccountId),
  ]);

  const value: ChainBalances = {
    agentAccountId: env.hederaAccountId,
    agentBalanceHbar,
    merchantAccountId: env.merchantAccountId,
    merchantBalanceHbar,
  };
  cached = { at: Date.now(), value };
  return value;
}
