-- Every request the agent ever made, and what the engine decided.
CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL, -- ISO8601 UTC
  service TEXT NOT NULL,
  amount_hbar REAL NOT NULL,
  reason TEXT, -- the agent's stated reason (untrusted, display only)
  decision TEXT NOT NULL, -- ALLOW | ESCALATE | DENY
  decision_code TEXT NOT NULL, -- e.g. NOT_ALLOWLISTED, OVER_TX_LIMIT, OVER_DAILY_BUDGET
  signals_json TEXT NOT NULL, -- what the signal layer observed
  settled INTEGER NOT NULL DEFAULT 0,
  tx_id TEXT -- Hedera transaction id, once settled
);

-- Escalated intents. One row per escalation. Single-use enforced here.
CREATE TABLE IF NOT EXISTS intents (
  intent_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES payment_requests(id),
  service TEXT NOT NULL,
  recipient TEXT NOT NULL,
  amount_hbar REAL NOT NULL,
  reason TEXT NOT NULL, -- escalation reason code
  expires_at TEXT NOT NULL,
  hmac TEXT NOT NULL,
  status TEXT NOT NULL, -- PENDING | APPROVED | EXPIRED | CONSUMED
  consumed_at TEXT
);

-- Replay defence for device responses.
CREATE TABLE IF NOT EXISTS device_nonces (
  nonce TEXT PRIMARY KEY,
  intent_id TEXT NOT NULL,
  seen_at TEXT NOT NULL
);

-- Rolling budget window control. Single row, id=1. reset-day bumps epoch_at
-- so daily-spend queries only count settlements after it, without waiting
-- on any real clock boundary.
CREATE TABLE IF NOT EXISTS budget_epoch (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  epoch_at TEXT NOT NULL
);
INSERT OR IGNORE INTO budget_epoch (id, epoch_at) VALUES (1, '1970-01-01T00:00:00.000Z');
