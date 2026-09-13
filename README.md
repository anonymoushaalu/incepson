# AgentPay

An autonomous LLM agent can *request* payments. It can never *authorize* them.


Every payment an agent asks for passes through a deterministic policy engine
— plain TypeScript, no language model, no I/O — that resolves the request to
exactly one of three outcomes:

- **ALLOW** — small, in-budget, allowlisted. Settles over [x402](https://github.com/x402-foundation/x402) on Hedera testnet, autonomously.
- **ESCALATE** — legal but worth a human's attention. Suspended until a physical button is pressed on an ESP32.
- **DENY** — breaches a hard limit. Refused unconditionally. No appeal.

The agent's only spending affordance is one tool call:
`request_payment(service, amount, reason)`. It has no import path to the
code that actually moves money — that boundary is enforced by module
structure, a grep check, and a test, not by convention.

## Why this exists

Payment-enabled agents need a security story that doesn't reduce to "trust
the model." This project's answer: keep authorization *outside* the model
entirely. The policy is data (`policy.json`), the enforcement is a pure
function you can unit-test with a frozen clock, and the last line of defense
against anything the policy can't anticipate is a person's thumb on a
button — a device that holds no key material and can't move funds itself.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  DASHBOARD  (React + Vite + Tailwind, :5173)                 │
│  budget · decision feed · pending intent · policy.json        │
└───────────────────────────────△───────────────────────────────┘
                                 │ SSE /api/stream
┌────────────────────────────────┼───────────────────────────────┐
│  AGENTPAY BACKEND  (Node + TS + Express, :3000)                 │
│                                                                  │
│   agent/  ──▶  broker/  ──▶  signals/ (deterministic)            │
│   1 tool        │              │                                │
│                 │              ▼                                │
│                 │           policy/  ◀── NO LLM, pure functions  │
│                 │         ALLOW│ESCALATE│DENY                   │
│                 ▼             ▼   ▼      ▼                       │
│              payments/    intents/   ledger/ (SQLite)            │
│           (only @x402/* import)                                  │
└──────────┬──────────────────┬───────────────────────────────────┘
           │ X-Payment          │ poll / approve (HMAC, HTTP)
           ▼                    ▼
   ┌───────────────┐    ┌───────────────────┐
   │ MERCHANT :4001 │    │ ESP32              │
   │ /honest         │    │ OLED + button       │
   │ /malicious      │    │ NO KEY MATERIAL     │
   └───────┬─────────┘    └────────────────────┘
           ▼
   x402.org facilitator ──▶ Hedera testnet (HashScan)
```

Two Node processes and one microcontroller — not microservices. The split
exists because the agent makes a genuine HTTP call to a genuine remote
server that returns a genuine `402`. Faking that in-process would make the
whole demo a lie.

**The enforcement boundary**, stated precisely: `agent/` imports only
`broker.requestPayment()`. It has no import path to `payments/`, the one
module allowed to import `@x402/*`. This holds three ways — module
structure, `grep -rn "payments/" src/agent/` (must return nothing), and a
unit test asserting settlement is reachable only on the ALLOW branch.

## What's real

A live payment settled on Hedera testnet during development:
[**HashScan: 0.0.9185802-1789208532-496960451**](https://hashscan.io/testnet/transaction/0.0.9185802-1789208532-496960451)
— `SUCCESS`, the merchant account credited exactly the priced amount, paid
through the public [x402.org facilitator](https://x402.org/facilitator) with
no API key.

## Quick start

```bash
npm install
cp .env.example .env   # fill in Hedera testnet accounts + OpenAI key, see below

npm run merchant   # :4001 — the (honest + malicious) x402-gated APIs
npm run dev        # :3000 — policy engine, broker, ledger, device endpoints

cd web && npm install && npm run dev   # :5173 — dashboard
```

Open `http://localhost:5173`. Full inline commands, including the Hedera
account setup and the facilitator health check, are in
[`docs/RUNBOOK.md`](docs/RUNBOOK.md).

### Required `.env` values

| Variable | What it is |
|---|---|
| `HEDERA_ACCOUNT_ID` / `HEDERA_PRIVATE_KEY` | The agent's paying testnet account. Fund it at [portal.hedera.com](https://portal.hedera.com). |
| `HEDERA_KEY_TYPE` | `ED25519` or `ECDSA` — **check the account's real on-chain type**, don't guess (`curl https://testnet.mirrornode.hedera.com/api/v1/accounts/<id>`). Guessing wrong signs successfully but fails verification with no client-side error. |
| `MERCHANT_ACCOUNT_ID` | The merchant's receiving testnet account. |
| `OPENAI_API_KEY` | Drives the agent's tool-calling loop. |
| `DEVICE_HMAC_SECRET` | Shared with the ESP32 at flash time. Generate with `openssl rand -hex 32`. |

## The policy (`policy.json`)

```json
{
  "max_tx_hbar": 0.10,
  "soft_limit_hbar": 0.05,
  "daily_budget_hbar": 0.30,
  "budget_window": "rolling_24h",
  "service_allowlist": ["gas-oracle.local", "eth-price.local"],
  "escalate_on": ["injection_detected", "amount_anomalous"]
}
```

Evaluation order is itself a security property: **hard denials first**
(allowlist → per-transaction limit → aggregate budget), **then escalation
signals**. A request that is both anomalous and over budget is denied, never
escalated — otherwise a human could be socially engineered into approving
what the policy already forbids. The allowlist is an unconditional boundary
with no appeal path; nothing "known but not yet allowlisted" exists in this
build.

Budget is a **rolling 24 hours**, not a calendar day — a calendar boundary
is a free reset an attacker can wait for. `POST /api/dev/reset-day` bumps an
explicit epoch so rehearsal never waits on a real clock.

## The four demo scenes

1. **Autonomous** — an in-budget, allowlisted request settles with zero
   human involvement. Watch the transaction land on HashScan.
2. **Escalation** — a legal-but-notable amount lights up the OLED. A human
   presses a button. Nothing settles until they do.
3. **Injection** — a malicious API returns real data plus a hidden
   instruction to buy from a non-allowlisted service. The agent is *not*
   filtered from seeing it — it gets fooled and tries. The policy engine
   refuses anyway, before it ever considers the injection signal, because
   the target service was never on the allowlist.
4. **Drip** — five individually-legal micropayments. The first several
   settle autonomously; the aggregate budget denies the one that would tip
   the total over.

Full script, with the exact curl commands and what to say, in
[`docs/DEMO.md`](docs/DEMO.md).

## Repository layout

```
policy.json              the security claim, as data
schema.sql               three SQLite tables, no migrations
src/
  policy/                pure evaluate(); zero I/O, zero LLM, injected clock
  signals/                deterministic injection scanner + amount-anomaly check
  intents/                HMAC-signed, single-use escalation intents
  payments/x402.ts        the ONLY module that imports @x402/* client code
  broker/                 wires agent → policy → settle/refuse/escalate
  agent/                  OpenAI tool-calling loop, one tool, zero Hedera knowledge
  ledger/                 SQLite reads/writes, rolling-budget query
  routes/                 dashboard (REST + SSE), device (poll/approve), agent
  merchant.ts             the (honest + malicious) x402-gated APIs, :4001
  index.ts                backend entry, :3000
web/                      React + Vite + Tailwind dashboard
firmware/
  agentpay_device/        ESP32 + SSD1306 + button firmware
  hmac_bringup/           standalone sketch to de-risk mbedtls/md.h before flashing the real thing
docs/
  PLAN.md                 verification log, resolved design decisions, live-corrected package findings
  RUNBOOK.md              copy-paste commands, phase by phase
  DEMO.md                 the four-scene script
```

## Testing

```bash
npm test          # 28 tests: policy engine, intents (HMAC/tamper/replay/expiry), broker integration
npm run build     # tsc, backend
cd web && npm run build   # tsc + vite, dashboard
```

The policy engine's tests cover every branch plus exact boundary values
(`amount == max_tx_hbar`, `spent + amount == daily_budget`) and the
five-charge drip sequence. The intents tests include the actual adversarial
checks — tamper (wrong HMAC), replay (reused nonce), double-consume, and
expiry — which are verification and demo simultaneously. A pinned
cross-language HMAC test vector guards the wire format shared with the
firmware.

The one ground-truth query that matters, run after every rehearsal:

```bash
npx tsx scripts/db-query.mjs \
  "SELECT COUNT(*) FROM payment_requests WHERE decision='DENY' AND (settled=1 OR tx_id IS NOT NULL);"
```

Must be `0`. If it's ever not, nothing else in this project counts.

## Firmware

The ESP32 polls `GET /device/pending` every 2s (outbound-initiated, no port
forwarding needed on venue WiFi), verifies the server's HMAC **locally**
before rendering anything, and refuses to arm the button on a mismatch. A
press returns `intent_id + nonce + hmac`; the backend re-verifies all three,
checks the intent is still `PENDING` and unexpired, and marks it `CONSUMED`
atomically so the same approval can never settle twice.

```bash
arduino-cli core install esp32:esp32
arduino-cli lib install "Adafruit SSD1306" "Adafruit GFX Library" "ArduinoJson"

# Compile this FIRST — it has no WiFi/OLED dependency and proves
# mbedtls/md.h works in your core version before anything depends on it.
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/hmac_bringup
# Expected serial output: bcc889a40667cab715e1dc22ad280692cf4bf1c3a280eeeca60d8dbcd8e4b993

cp firmware/agentpay_device/secrets.h.example firmware/agentpay_device/secrets.h
# fill in WiFi + your machine's LAN IP + the same DEVICE_HMAC_SECRET as .env
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/agentpay_device
```

**Not yet compiled against real hardware** — no ESP32 was available while
this was built. Every server-side piece of the escalation loop (HMAC sign
and verify, tamper rejection, replay rejection, expiry, the swap defense) is
covered by automated tests and was exercised live against the running
backend; the firmware itself needs a physical bring-up pass.

## Explicitly out of scope

Transaction simulation, ERC-7730, Ledger integration, Chainlink, generic
wallet interception, user accounts, a policy-editing UI, mainnet, key
custody on the ESP32, Docker/CI/Kubernetes, and an LLM-based injection
classifier — putting a model back inside the decision path would destroy
the central claim that detection is deterministic and outside the model.

## Documentation

- [`docs/PLAN.md`](docs/PLAN.md) — every package signature verified against
  installed source (not memory), corrections to the original blueprint, and
  the resolved design decisions (day boundary, amount-anomaly definition,
  the allowlist/escalation contradiction).
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — copy-paste commands for every phase.
- [`docs/DEMO.md`](docs/DEMO.md) — the four-scene pitch script.
