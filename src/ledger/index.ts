import { db } from "../db.js";
import type { Decision, PaymentRequest, Signals } from "../policy/types.js";

export interface PaymentRequestRow {
  id: string;
  created_at: string;
  service: string;
  amount_hbar: number;
  reason: string | null;
  decision: Decision;
  decision_code: string;
  signals_json: string;
  settled: number;
  tx_id: string | null;
}

const insertRequestStmt = db.prepare(`
  INSERT INTO payment_requests (id, created_at, service, amount_hbar, reason, decision, decision_code, signals_json, settled, tx_id)
  VALUES (@id, @created_at, @service, @amount_hbar, @reason, @decision, @decision_code, @signals_json, @settled, @tx_id)
`);

export function recordRequest(params: {
  id: string;
  req: PaymentRequest;
  decision: Decision;
  decisionCode: string;
  signals: Signals;
  settled: boolean;
  txId?: string;
  now: Date;
}): void {
  insertRequestStmt.run({
    id: params.id,
    created_at: params.now.toISOString(),
    service: params.req.service,
    amount_hbar: params.req.amount_hbar,
    reason: params.req.reason,
    decision: params.decision,
    decision_code: params.decisionCode,
    signals_json: JSON.stringify(params.signals),
    settled: params.settled ? 1 : 0,
    tx_id: params.txId ?? null,
  });
}

export function markSettled(id: string, txId: string): void {
  db.prepare(`UPDATE payment_requests SET settled = 1, tx_id = ? WHERE id = ?`).run(txId, id);
}

const epochStmt = db.prepare(`SELECT epoch_at FROM budget_epoch WHERE id = 1`);

/**
 * Rolling 24h window since the later of (now - 24h) or the last reset epoch.
 * The epoch exists so a demo can be re-armed on demand without waiting on a
 * real clock boundary -- see resetBudgetWindow.
 */
export function spentInWindow(now: Date): number {
  const epoch = epochStmt.get() as { epoch_at: string };
  const windowStart = new Date(Math.max(
    new Date(epoch.epoch_at).getTime(),
    now.getTime() - 24 * 60 * 60 * 1000
  )).toISOString();

  const row = db
    .prepare(
      `SELECT COALESCE(SUM(amount_hbar), 0) AS total FROM payment_requests WHERE settled = 1 AND created_at >= ?`
    )
    .get(windowStart) as { total: number };
  return row.total;
}

/** Bumps the budget epoch to now, so spentInWindow ignores everything settled before this call. */
export function resetBudgetWindow(now: Date): void {
  db.prepare(`UPDATE budget_epoch SET epoch_at = ? WHERE id = 1`).run(now.toISOString());
}

export function settledAmountsForService(service: string, limit = 50): number[] {
  const rows = db
    .prepare(
      `SELECT amount_hbar FROM payment_requests WHERE settled = 1 AND service = ? ORDER BY created_at DESC LIMIT ?`
    )
    .all(service, limit) as { amount_hbar: number }[];
  return rows.map((r) => r.amount_hbar);
}

export function recentRequests(limit = 50): PaymentRequestRow[] {
  return db
    .prepare(`SELECT * FROM payment_requests ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as PaymentRequestRow[];
}
