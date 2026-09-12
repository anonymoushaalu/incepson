import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";
import { env, policy } from "../config.js";

// HMAC input, byte-identical both sides. Fixed order. No JSON key ordering.
// intent_id|service|recipient|amount|reason|expires_at
// amount formatted with exactly 8 decimals (HBAR's precision). HMAC-SHA256,
// lowercase hex. Decided once here; firmware/agentpay_device/agentpay_device.ino
// must reproduce this exact format.
export function canonicalize(fields: {
  intentId: string;
  service: string;
  recipient: string;
  amountHbar: number;
  reason: string;
  expiresAt: string;
}): string {
  const amount = fields.amountHbar.toFixed(8);
  return `${fields.intentId}|${fields.service}|${fields.recipient}|${amount}|${fields.reason}|${fields.expiresAt}`;
}

export function sign(canonical: string): string {
  return createHmac("sha256", env.deviceHmacSecret).update(canonical).digest("hex");
}

export function verifyHmac(canonical: string, hmac: string): boolean {
  const expected = Buffer.from(sign(canonical), "hex");
  const actual = Buffer.from(hmac, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface IntentRow {
  intent_id: string;
  request_id: string;
  service: string;
  recipient: string;
  amount_hbar: number;
  reason: string;
  expires_at: string;
  hmac: string;
  status: "PENDING" | "APPROVED" | "EXPIRED" | "CONSUMED";
  consumed_at: string | null;
}

const insertIntentStmt = db.prepare(`
  INSERT INTO intents (intent_id, request_id, service, recipient, amount_hbar, reason, expires_at, hmac, status)
  VALUES (@intent_id, @request_id, @service, @recipient, @amount_hbar, @reason, @expires_at, @hmac, 'PENDING')
`);

export function createIntent(params: {
  requestId: string;
  service: string;
  recipient: string;
  amountHbar: number;
  reasonCode: string;
  now: Date;
}): IntentRow {
  const intentId = randomUUID();
  const expiresAt = new Date(params.now.getTime() + policy.escalation_timeout_sec * 1000).toISOString();
  const canonical = canonicalize({
    intentId,
    service: params.service,
    recipient: params.recipient,
    amountHbar: params.amountHbar,
    reason: params.reasonCode,
    expiresAt,
  });
  const hmac = sign(canonical);

  const row: IntentRow = {
    intent_id: intentId,
    request_id: params.requestId,
    service: params.service,
    recipient: params.recipient,
    amount_hbar: params.amountHbar,
    reason: params.reasonCode,
    expires_at: expiresAt,
    hmac,
    status: "PENDING",
    consumed_at: null,
  };
  insertIntentStmt.run(row);
  return row;
}

// Filters expires_at even though status should already reflect it -- a
// timed-out escalation whose expireStaleIntents call hasn't landed yet (or
// was skipped) must never be served to the device as still-live.
export function getPendingIntent(now: Date = new Date()): IntentRow | undefined {
  return db
    .prepare(`SELECT * FROM intents WHERE status = 'PENDING' AND expires_at > ? ORDER BY expires_at ASC LIMIT 1`)
    .get(now.toISOString()) as IntentRow | undefined;
}

export function getIntent(intentId: string): IntentRow | undefined {
  return db.prepare(`SELECT * FROM intents WHERE intent_id = ?`).get(intentId) as IntentRow | undefined;
}

export type ApprovalError =
  | "NOT_FOUND"
  | "NOT_PENDING"
  | "EXPIRED"
  | "BAD_HMAC"
  | "NONCE_REUSED";

/**
 * Verifies HMAC, rejects seen nonces, requires PENDING + unexpired, and marks
 * CONSUMED in one transaction so a duplicate approval cannot settle twice.
 * Returns the intent row on success -- callers settle from THIS row, never
 * from the agent's original request object (see broker/index.ts).
 */
export const approveIntent = db.transaction(
  (intentId: string, nonce: string, hmac: string, now: Date): { ok: true; intent: IntentRow } | { ok: false; error: ApprovalError } => {
    const intent = getIntent(intentId);
    if (!intent) return { ok: false, error: "NOT_FOUND" };

    const canonical = canonicalize({
      intentId: intent.intent_id,
      service: intent.service,
      recipient: intent.recipient,
      amountHbar: intent.amount_hbar,
      reason: intent.reason,
      expiresAt: intent.expires_at,
    });
    if (!verifyHmac(canonical, hmac)) return { ok: false, error: "BAD_HMAC" };

    const nonceSeen = db.prepare(`SELECT 1 FROM device_nonces WHERE nonce = ?`).get(nonce);
    if (nonceSeen) return { ok: false, error: "NONCE_REUSED" };

    if (intent.status !== "PENDING") return { ok: false, error: "NOT_PENDING" };
    if (new Date(intent.expires_at).getTime() < now.getTime()) {
      db.prepare(`UPDATE intents SET status = 'EXPIRED' WHERE intent_id = ?`).run(intentId);
      return { ok: false, error: "EXPIRED" };
    }

    db.prepare(`INSERT INTO device_nonces (nonce, intent_id, seen_at) VALUES (?, ?, ?)`).run(
      nonce,
      intentId,
      now.toISOString()
    );
    db.prepare(`UPDATE intents SET status = 'CONSUMED', consumed_at = ? WHERE intent_id = ?`).run(
      now.toISOString(),
      intentId
    );

    return { ok: true, intent: { ...intent, status: "CONSUMED", consumed_at: now.toISOString() } };
  }
);

export function expireStaleIntents(now: Date): void {
  db.prepare(`UPDATE intents SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at < ?`).run(
    now.toISOString()
  );
}
