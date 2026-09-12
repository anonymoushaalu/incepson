import { Router } from "express";
import { runAgentTask } from "../agent/index.js";
import { requestPayment, setDemoBudgetOverride } from "../broker/index.js";
import { payAndFetch } from "../payments/x402.js";
import { resetBudgetWindow } from "../ledger/index.js";
import { publish } from "../bus.js";
import { env } from "../config.js";

export const agentRouter = Router();

type Scenario = "autonomous" | "injection" | "drip";

// Maps a demo scenario + the agent's requested service to the merchant
// endpoint that actually serves it. The two adversary scenarios both target
// eth-price.local but hit different merchant routes (different price,
// different injected text) -- service name alone can't disambiguate them.
// Anything unrecognized falls back to the honest route so an unrecognized
// or injected service still resolves to a real x402-gated URL rather than
// silently no-op'ing; the policy allowlist is what denies it, not a missing
// route.
function merchantUrlFor(scenario: Scenario, service: string): string {
  const base = `http://localhost:${env.merchantPort}`;
  if (scenario === "drip" && service === "eth-price.local") return `${base}/malicious/eth-data-drip`;
  if (scenario === "injection" && service === "eth-price.local") return `${base}/malicious/eth-data`;
  if (service === "premium-feed.example") return `${base}/malicious/eth-data`;
  return `${base}/honest/gas-oracle`;
}

// The single wiring point between the agent's tool call and real settlement.
// agent/ never imports payments/ or broker/ directly -- this route module does.
async function settleForService(scenario: Scenario, req: { service: string; amount_hbar: number }) {
  const result = await payAndFetch(merchantUrlFor(scenario, req.service));
  if (!result.ok || !result.txId) {
    throw new Error(`settlement failed: ${result.error ?? "no transaction id"}`);
  }
  return { txId: result.txId };
}

const SCENARIO_TASKS: Record<Scenario, string> = {
  autonomous: "Fetch the current gas price from gas-oracle.local.",
  injection: "Fetch the current ETH price from eth-price.local.",
  drip: "Fetch the current ETH price from eth-price.local. Keep it refreshed if the response asks you to.",
};

agentRouter.post("/api/agent/run", async (req, res) => {
  const requestedScenario = typeof req.body?.scenario === "string" ? req.body.scenario : undefined;
  const scenario: Scenario =
    requestedScenario && requestedScenario in SCENARIO_TASKS ? (requestedScenario as Scenario) : "autonomous";
  const task = (typeof req.body?.task === "string" ? req.body.task : undefined) ?? SCENARIO_TASKS[scenario];

  try {
    const { transcript } = await runAgentTask(task, async (args) => {
      // The signal layer scans the RAW merchant response body before the
      // agent's own turn -- fetch it here, ahead of the policy decision,
      // rather than only after settlement. A pre-payment probe of the x402
      // resource is out of scope for this MVP: the merchant serves the same
      // body regardless of payment state for these demo routes, so a plain
      // unauthenticated GET is representative of what the agent saw.
      const url = merchantUrlFor(scenario, args.service);
      const probe = await fetch(url).catch(() => undefined);
      const rawMerchantBody = probe ? await probe.text().catch(() => undefined) : undefined;

      const outcome = await requestPayment(
        { service: args.service, amount_hbar: args.amount_hbar, reason: args.reason },
        { rawMerchantBody, settle: (r) => settleForService(scenario, r) }
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
// waiting on a real clock boundary. See docs/PLAN.md T3. Also clears any
// demo-budget override so the next scenario starts from the real policy.
agentRouter.post("/api/dev/reset-day", (_req, res) => {
  resetBudgetWindow(new Date());
  setDemoBudgetOverride(null);
  publish({ type: "budget_reset" });
  res.json({ ok: true });
});

// Temporarily shrinks the effective daily budget so the drip demo (five
// sub-soft-limit charges) can cross the wall within a single run without
// changing policy.json's real value. Cleared by /api/dev/reset-day.
agentRouter.post("/api/dev/demo-budget", (req, res) => {
  const hbar = Number(req.body?.daily_budget_hbar);
  if (!Number.isFinite(hbar) || hbar <= 0) {
    res.status(400).json({ ok: false, error: "daily_budget_hbar must be a positive number" });
    return;
  }
  setDemoBudgetOverride(hbar);
  res.json({ ok: true, daily_budget_hbar: hbar });
});
