import { Router } from "express";
import { writeFileSync } from "node:fs";
import { queryRequests, getRequestById, decisionCodeCounts, spentInWindow, settledAmountsForService } from "../ledger/index.js";
import { listIntents } from "../intents/index.js";
import { getChainBalances } from "../hedera-mirror.js";
import { policy, env } from "../config.js";
import { evaluate } from "../policy/engine.js";
import { evaluateSignals } from "../signals/index.js";
import { sendError, requireDevEndpointsEnabled } from "../errors.js";
import type { Decision } from "../policy/types.js";

export const apiRouter = Router();

// GET /api/config
// Read-only snapshot of the editable policy fields plus the account ids the
// UI needs to label "agent" vs "merchant" -- never the private key.
apiRouter.get("/api/config", (_req, res) => {
  res.json({
    policy: {
      agent_id: policy.agent_id,
      max_tx_hbar: policy.max_tx_hbar,
      soft_limit_hbar: policy.soft_limit_hbar,
      daily_budget_hbar: policy.daily_budget_hbar,
      service_allowlist: policy.service_allowlist,
    },
    accounts: {
      agentAccountId: env.hederaAccountId,
      merchantAccountId: env.merchantAccountId,
    },
  });
});

const POLICY_JSON_URL = new URL("../../policy.json", import.meta.url);

// PUT /api/policy { max_tx_hbar?, soft_limit_hbar?, daily_budget_hbar?, service_allowlist? }
// Dev-only: persists edited limits to policy.json and mutates the in-memory
// `policy` object's fields in place (not a reassignment) so every module
// that imported it by reference -- broker, intents, dashboard, this router
// -- sees the new values immediately, with no process restart.
apiRouter.put("/api/policy", requireDevEndpointsEnabled, (req, res) => {
  const body = req.body ?? {};
  const next = { ...policy };

  if (body.max_tx_hbar !== undefined) {
    const v = Number(body.max_tx_hbar);
    if (!Number.isFinite(v) || v <= 0) { sendError(res, 400, "INVALID_REQUEST", "max_tx_hbar must be a positive number"); return; }
    next.max_tx_hbar = v;
  }
  if (body.soft_limit_hbar !== undefined) {
    const v = Number(body.soft_limit_hbar);
    if (!Number.isFinite(v) || v <= 0) { sendError(res, 400, "INVALID_REQUEST", "soft_limit_hbar must be a positive number"); return; }
    next.soft_limit_hbar = v;
  }
  if (body.daily_budget_hbar !== undefined) {
    const v = Number(body.daily_budget_hbar);
    if (!Number.isFinite(v) || v <= 0) { sendError(res, 400, "INVALID_REQUEST", "daily_budget_hbar must be a positive number"); return; }
    next.daily_budget_hbar = v;
  }
  if (body.service_allowlist !== undefined) {
    if (!Array.isArray(body.service_allowlist) || !body.service_allowlist.every((s: unknown) => typeof s === "string")) {
      sendError(res, 400, "INVALID_REQUEST", "service_allowlist must be an array of strings");
      return;
    }
    next.service_allowlist = body.service_allowlist;
  }

  Object.assign(policy, next);
  writeFileSync(POLICY_JSON_URL, JSON.stringify(policy, null, 2) + "\n");
  res.json({ ok: true, policy });
});

const VALID_DECISIONS: Decision[] = ["ALLOW", "ESCALATE", "DENY"];

function parseDecision(value: unknown): Decision | undefined {
  return typeof value === "string" && (VALID_DECISIONS as string[]).includes(value) ? (value as Decision) : undefined;
}

// GET /api/requests?decision=&code=&service=&since=&limit=&offset=
// Backs /decisions. Paginated payment_requests with optional filters.
apiRouter.get("/api/requests", (req, res) => {
  const { rows, total } = queryRequests({
    decision: parseDecision(req.query.decision),
    code: typeof req.query.code === "string" ? req.query.code : undefined,
    service: typeof req.query.service === "string" ? req.query.service : undefined,
    since: typeof req.query.since === "string" ? req.query.since : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json({ rows, total });
});

// GET /api/requests/:id
// One request, its parsed signals, and its HashScan-ready tx id if settled.
// Backs the /decisions detail drawer.
apiRouter.get("/api/requests/:id", (req, res) => {
  const row = getRequestById(req.params.id);
  if (!row) {
    sendError(res, 404, "NOT_FOUND", `No request with id "${req.params.id}".`);
    return;
  }
  let signals: unknown = null;
  try {
    signals = JSON.parse(row.signals_json);
  } catch {
    // signals_json is always written by recordRequest as JSON.stringify(...);
    // a parse failure here would mean the row was corrupted some other way.
    // Surface null rather than 500 -- the rest of the row is still useful.
  }
  res.json({ ...row, signals });
});

// GET /api/intents
// Full intent history (not just the currently-pending one). Backs /device's
// history view.
apiRouter.get("/api/intents", (_req, res) => {
  res.json(listIntents());
});

// GET /api/chain/transactions
// Settled requests only, shaped for the /chain page: one row per
// transaction rather than per request, with the HashScan URL prebuilt.
apiRouter.get("/api/chain/transactions", (_req, res) => {
  const { rows } = queryRequests({ limit: 500 });
  const settled = rows
    .filter((r) => r.tx_id)
    .map((r) => ({
      tx_id: r.tx_id,
      amount_hbar: r.amount_hbar,
      service: r.service,
      created_at: r.created_at,
      request_id: r.id,
      hashscan_url: `https://hashscan.io/testnet/transaction/${r.tx_id}`,
    }));
  res.json(settled);
});

// GET /api/chain/balances
// Agent + merchant HBAR balances via the Hedera mirror node, cached 15s.
// Backs /chain's balance panel.
apiRouter.get("/api/chain/balances", async (_req, res) => {
  const balances = await getChainBalances();
  res.json(balances);
});

// GET /api/policy/gates
// Per-decision-code counts across every recorded request, keyed to match
// the gate ids the /policy page already renders (allowlist, tx_limit,
// daily_budget, injection, anomaly, allow).
apiRouter.get("/api/policy/gates", (_req, res) => {
  const counts = decisionCodeCounts();
  res.json({
    allowlist: counts.NOT_ALLOWLISTED ?? 0,
    tx_limit: counts.OVER_TX_LIMIT ?? 0,
    daily_budget: counts.OVER_DAILY_BUDGET ?? 0,
    injection: counts.INJECTION_DETECTED ?? 0,
    anomaly: counts.AMOUNT_ANOMALOUS ?? 0,
    allow: counts.OK ?? 0,
    escalation_timeout: counts.ESCALATION_TIMEOUT ?? 0,
    approved_by_device: counts.APPROVED_BY_DEVICE ?? 0,
    policy: { max_tx_hbar: policy.max_tx_hbar, daily_budget_hbar: policy.daily_budget_hbar },
  });
});

// POST /api/policy/simulate { service, amount_hbar, merchant_body? }
// Runs the REAL server-side evaluate() against a hypothetical request --
// never recorded, never settled. Makes /policy's "simulate a request"
// control authoritative instead of the client-side port in
// web/src/policy/evaluate.ts, which can drift from this file over time.
apiRouter.post("/api/policy/simulate", (req, res) => {
  const service = req.body?.service;
  const amount_hbar = Number(req.body?.amount_hbar);
  const merchantBody = typeof req.body?.merchant_body === "string" ? req.body.merchant_body : undefined;

  if (typeof service !== "string" || !Number.isFinite(amount_hbar)) {
    sendError(res, 400, "INVALID_REQUEST", "service (string) and amount_hbar (number) are required");
    return;
  }

  const now = new Date();
  const spend = { spent_window_hbar: spentInWindow(now) };
  const history = { settledAmountsForService: settledAmountsForService(service) };
  const signals = evaluateSignals(amount_hbar, merchantBody, history, policy);
  const result = evaluate({ service, amount_hbar, reason: "simulation" }, policy, spend, signals, now);

  res.json({ ...result, signals, spent_window_hbar: spend.spent_window_hbar });
});
