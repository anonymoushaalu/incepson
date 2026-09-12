import { Router } from "express";
import { runAgentTask } from "../agent/index.js";
import { requestPayment } from "../broker/index.js";
import { payAndFetch } from "../payments/x402.js";
import { resetBudgetWindow } from "../ledger/index.js";
import { publish } from "../bus.js";
import { env } from "../config.js";

export const agentRouter = Router();

const MERCHANT_URL_FOR = (service: string) => `http://localhost:${env.merchantPort}/honest/gas-oracle`;

// The single wiring point between the agent's tool call and real settlement.
// agent/ never imports payments/ or broker/ directly -- this route module does.
async function settleForService(req: { service: string; amount_hbar: number }) {
  const result = await payAndFetch(MERCHANT_URL_FOR(req.service));
  if (!result.ok || !result.txId) {
    throw new Error(`settlement failed: ${result.error ?? "no transaction id"}`);
  }
  return { txId: result.txId };
}

agentRouter.post("/api/agent/run", async (req, res) => {
  const task = typeof req.body?.task === "string" ? req.body.task : "Fetch the current gas price from gas-oracle.local.";

  try {
    const { transcript } = await runAgentTask(task, async (args) => {
      const outcome = await requestPayment(
        { service: args.service, amount_hbar: args.amount_hbar, reason: args.reason },
        { settle: settleForService }
      );
      return {
        decision: outcome.result.decision,
        code: outcome.result.code,
        explanation: outcome.result.explanation,
      };
    });
    res.json({ transcript });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "agent task failed" });
  }
});

// Bumps the rolling-24h budget epoch so the demo can be re-run without
// waiting on a real clock boundary. See docs/PLAN.md T3.
agentRouter.post("/api/dev/reset-day", (_req, res) => {
  resetBudgetWindow(new Date());
  publish({ type: "budget_reset" });
  res.json({ ok: true });
});
