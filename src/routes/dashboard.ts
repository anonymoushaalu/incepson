import { Router } from "express";
import { subscribe } from "../bus.js";
import { spentInWindow, recentRequests } from "../ledger/index.js";
import { policy } from "../config.js";

export const dashboardRouter = Router();

function snapshot() {
  const now = new Date();
  return {
    policy,
    spentWindowHbar: spentInWindow(now),
    remainingHbar: policy.daily_budget_hbar - spentInWindow(now),
    recentRequests: recentRequests(50),
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

  const unsubscribe = subscribe((event) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", unsubscribe);
});
