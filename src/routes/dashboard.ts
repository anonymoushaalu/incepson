import { Router } from "express";
import { subscribe, eventsSince } from "../bus.js";
import { spentInWindow, recentRequests, decisionCodeCounts } from "../ledger/index.js";
import { getPendingIntent, listIntents } from "../intents/index.js";
import { policy } from "../config.js";

export const dashboardRouter = Router();

function snapshot() {
  const now = new Date();
  const counts = decisionCodeCounts();
  return {
    policy,
    spentWindowHbar: spentInWindow(now),
    remainingHbar: policy.daily_budget_hbar - spentInWindow(now),
    recentRequests: recentRequests(50),
    pendingIntent: getPendingIntent(now) ?? null,
    // Added for B3: a cold page load needs one request instead of six --
    // /device's history and /policy's gate counters used to each need their
    // own fetch on mount; now they're already in the snapshot everyone gets.
    intentHistory: listIntents(50),
    gateCounts: {
      allowlist: counts.NOT_ALLOWLISTED ?? 0,
      tx_limit: counts.OVER_TX_LIMIT ?? 0,
      daily_budget: counts.OVER_DAILY_BUDGET ?? 0,
      injection: counts.INJECTION_DETECTED ?? 0,
      anomaly: counts.AMOUNT_ANOMALOUS ?? 0,
      allow: counts.OK ?? 0,
    },
  };
}

dashboardRouter.get("/api/state", (_req, res) => {
  res.json(snapshot());
});

// Server-Sent Events rather than websockets: state flows one way (server ->
// dashboard) and this needs no reconnect handling on a venue network.
dashboardRouter.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);

  // Browsers auto-reconnect EventSource and send back whatever id: value
  // arrived with the last event, letting us replay exactly the gap instead
  // of nothing (silent miss) or everything (redundant re-render storm).
  const lastEventIdHeader = req.headers["last-event-id"];
  const lastEventId = Number(Array.isArray(lastEventIdHeader) ? lastEventIdHeader[0] : lastEventIdHeader);
  if (Number.isFinite(lastEventId) && lastEventId > 0) {
    for (const { id, event } of eventsSince(lastEventId)) {
      res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
  }

  const unsubscribe = subscribe((id, event) => {
    res.write(`id: ${id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  // Some venue-network proxies idle-close a connection with no traffic for
  // ~30-60s; a comment line is invisible to EventSource's event listeners
  // (it has no "event:" or "data:" field) but keeps the socket active.
  const heartbeat = setInterval(() => res.write(`: heartbeat\n\n`), 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
