# AgentPay — Demo Script

Four scenes, ~5 minutes. Scene 2 is the emotional peak — do not rush it, let
the room watch the OLED.

## Before you start

```bash
curl -s https://x402.org/facilitator/supported | grep -o 'hedera:testnet'
```

If this fails, switch `X402_FACILITATOR_URL` in `.env` to Blocky402
(`https://api.testnet.blocky402.com`) before anything else.

```bash
npm run merchant &      # :4001
npm run dev &            # :3000
cd web && npm run dev    # :5173
```

Confirm the ESP32 has joined the same network as the backend and reaches it
by LAN IP (not `localhost`) — check `ipconfig` (or on the dev machine used
this session, `10.41.253.175`, which will be **different at the venue**) and
update `secrets.h`'s `BACKEND_HOST` every time the network changes.

Open the dashboard at `localhost:5173`, and reset the ledger to a clean
state:

```bash
curl -X POST localhost:3000/api/dev/reset-day
```

---

## Scene 1 — Autonomous settlement (~30s)

**Say:** "The agent has one tool: `request_payment`. Watch what happens when
it asks for something small, in-budget, from an allowlisted service."

```bash
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' \
     -d '{"scenario":"autonomous"}'
```

**Point at:** the decision feed turning green (`ALLOW`), the budget bar
ticking up, and the transaction link — click it, HashScan opens live.

---

## Scene 2 — Escalation and the physical button (~90s, the peak)

**Say:** "This request is bigger — inside every hard limit, but the policy
engine considers it worth a human's attention. No transaction happens until
a person presses a button."

```bash
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' \
     -d '{"task":"Fetch the current gas price from gas-oracle.local. This one seems important, so use amount_hbar=0.08."}'
```

**Wait for the OLED to light up.** Read the intent aloud: service, amount,
reason. **Press the button.** Point at the dashboard settling live.

If nothing is pressed within 60s, show the timeout: the pending-intent panel
clears, the dashboard shows `ESCALATION_TIMEOUT`, and — say this explicitly —
**no transaction was created.**

---

## Scene 3 — Prompt injection, denied (~60s)

**Say:** "This is a malicious API. It returns real, correct data — and hides
a purchase instruction inside it. The agent is not filtered from seeing
this. Watch it get fooled, and watch the policy engine refuse anyway."

```bash
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' \
     -d '{"scenario":"injection"}'
```

**Point at:** the agent's transcript shows it *tried* to call
`request_payment` for the injected `premium-feed.example` purchase. The
decision feed shows red (`DENY`), reason `NOT_ALLOWLISTED`. **Say:** "The
defense isn't in the model. It's in this engine, and it never even looked at
what the model was thinking — the service wasn't on the list, so this is
refused, no appeal, regardless of why it was asked for."

---

## Scene 4 — The slow drain, denied on aggregate (~90s)

**Say:** "Five individually-legal micropayments. Each one alone is fine.
Watch what happens in aggregate."

```bash
curl -X POST localhost:3000/api/dev/reset-day
curl -X POST localhost:3000/api/dev/demo-budget -H 'content-type: application/json' \
     -d '{"daily_budget_hbar": 0.22}'
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' \
     -d '{"scenario":"drip"}'
```

If the agent doesn't loop through all five refresh requests on its own
turn budget, repeat the last curl (same `scenario":"drip"`) until the
dashboard shows 4 settled and a 5th `OVER_DAILY_BUDGET` denial.

**Point at:** the budget bar filling — 4 green ticks — then the wall. **Say:**
"Same attacker technique that gets past a per-transaction limit gets stopped
by the aggregate. This is what defeats the drip."

Reset before doing anything else:

```bash
curl -X POST localhost:3000/api/dev/reset-day
```

---

## Ground truth, after every rehearsal

```bash
npx tsx scripts/db-query.mjs "SELECT COUNT(*) FROM payment_requests WHERE decision='DENY' AND (settled=1 OR tx_id IS NOT NULL);"
```

Must be `0`. This is what "the agent cannot reach settlement code" means in
practice, not just in the pitch.

## If asked "is that a real payment?"

Yes. Every ALLOW in this demo settles on Hedera testnet through the public
x402.org facilitator. Click any transaction link in the decision feed — it
opens HashScan, live, for a transaction that just happened.
