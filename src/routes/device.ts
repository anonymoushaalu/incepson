import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getPendingIntent, approveIntent, canonicalize, sign } from "../intents/index.js";
import { resolveEscalation } from "../broker/index.js";
import { publish } from "../bus.js";
import { sendError, requireDevEndpointsEnabled } from "../errors.js";

// /device/pending and /device/approve are the ESP32's contract -- their
// {ok, error} response shape is intentionally left as-is here rather than
// migrated to the {error, code} envelope, since changing it would also
// require updating firmware/agentpay_device/agentpay_device.ino, and no
// hardware was available this session to verify that change end-to-end.
// The newer frontend-facing endpoint below (simulate-approve) does use the
// shared envelope.

export const deviceRouter = Router();

// Polled by the ESP32 every ~2s (outbound-initiated, no port forwarding
// needed on venue WiFi). Returns the current signed intent or 204.
deviceRouter.get("/device/pending", (_req, res) => {
  const intent = getPendingIntent();
  if (!intent) {
    res.status(204).end();
    return;
  }
  res.json(intent);
});

// { intent_id, nonce, hmac } from a physical button press. Verifies HMAC,
// rejects seen nonces, requires PENDING + unexpired, marks CONSUMED
// atomically -- all inside intents.approveIntent's db.transaction.
deviceRouter.post("/device/approve", (req, res) => {
  const { intent_id, nonce, hmac } = req.body ?? {};
  if (typeof intent_id !== "string" || typeof nonce !== "string" || typeof hmac !== "string") {
    res.status(400).json({ ok: false, error: "BAD_REQUEST" });
    return;
  }

  const result = approveIntent(intent_id, nonce, hmac, new Date());
  if (!result.ok) {
    res.status(409).json({ ok: false, error: result.error });
    return;
  }

  const resolved = resolveEscalation(intent_id, true);
  publish({ type: "intent_resolved", intentId: intent_id, approved: true });
  res.json({ ok: true, resolved });
});

// POST /api/device/simulate-approve { intent_id }
// Software-approve a pending intent for rehearsal when the ESP32 isn't
// wired up. This is NOT a bypass of the HMAC check -- it computes the same
// canonical string and signs it with the server's own DEVICE_HMAC_SECRET
// (the server holds this secret regardless; the device is the only OTHER
// place that does), then calls the exact same approveIntent() the real
// device's approval goes through, nonce and all. Must be clearly flagged
// "(simulated)" in the UI per docs/FRONTEND_PLAN.md B2 -- this endpoint
// itself does not fake or weaken the verification path.
deviceRouter.post("/api/device/simulate-approve", requireDevEndpointsEnabled, (req, res) => {
  const intentId = req.body?.intent_id;
  if (typeof intentId !== "string") {
    sendError(res, 400, "BAD_REQUEST", "intent_id (string) is required");
    return;
  }

  const intent = getPendingIntent();
  if (!intent || intent.intent_id !== intentId) {
    sendError(res, 404, "NOT_FOUND", "No pending intent matches that id (it may have expired or already been consumed).");
    return;
  }

  const canonical = canonicalize({
    intentId: intent.intent_id,
    service: intent.service,
    recipient: intent.recipient,
    amountHbar: intent.amount_hbar,
    reason: intent.reason,
    expiresAt: intent.expires_at,
  });
  const hmac = sign(canonical);
  const nonce = randomUUID();

  const result = approveIntent(intentId, nonce, hmac, new Date());
  if (!result.ok) {
    sendError(res, 409, result.error, `Approval rejected: ${result.error}`);
    return;
  }

  resolveEscalation(intentId, true);
  publish({ type: "intent_resolved", intentId, approved: true });
  res.json({ ok: true, simulated: true });
});
