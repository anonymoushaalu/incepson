import { Router } from "express";
import { getPendingIntent, approveIntent } from "../intents/index.js";
import { resolveEscalation } from "../broker/index.js";
import { publish } from "../bus.js";

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
