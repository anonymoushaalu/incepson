# AgentPay — Commit Sequence

17 commits across 6 phases. Each is a working state you could demo from.

To use one, write it to a file and pass it — this avoids shell quoting entirely:

```bash
git commit -F docs/msg.txt
```

Every message ends with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

## Phase 0 — Scaffold

**1.**
```
chore: scaffold agentpay workspace and toolchain

Two-process layout (backend :3000, merchant :4001) plus a firmware tree, because
the agent must make a real HTTP call to a real remote server that returns a real
402 -- faking that in-process would make the demo a lie.

Versions are left for npm to resolve rather than pinned from memory. Module
resolution is nodenext so the @x402/* subpath exports resolve.
```

**2.**
```
chore: add sqlite schema and typed config loader

Three tables, created at boot with CREATE TABLE IF NOT EXISTS, no migration tool.
Daily spend is a query over the ledger rather than a stored column so derived
state cannot drift from what actually settled.

policy.json loads as data and stays separate from .env so it can be shown on
screen during the pitch.
```

---

## Phase 1 — Rails

**3.**
```
feat: x402-gated merchant endpoint on hedera testnet

Prices /honest/gas-oracle in native HBAR (asset 0.0.0) via ExactHederaScheme
registered on x402ResourceServer against the public x402.org facilitator, which
advertises hedera:testnet with no API key. Returns 402 with PaymentRequirements
when unpaid.
```

**4.**
```
feat: x402 hedera payment client

Confines every @x402/* import to src/payments/ so no other module can reach
settlement code. Signs the facilitator-supplied transfer and resubmits it in the
X-Payment header; the facilitator pays the network fee and cannot move funds
without this signed authorization.
```

---

## Phase 2 — Policy engine and the enforcement boundary

**5.**
```
feat: deterministic policy engine with injected clock

Pure evaluate() with no I/O, no network, no clock reads and no language model.
The clock is a parameter so budget logic is testable against a frozen time.

Hard denials are ordered before escalation signals: a request that is both
anomalous and over budget denies rather than asking a human to approve what
policy already forbids.

Resolves the allowlist contradiction in the spec -- the allowlist is an
unconditional boundary, so unknown_service is dropped from escalate_on.
```

**6.**
```
test: cover policy branches, boundaries and drip aggregate

Covers every branch plus the exact boundary values (amount == max_tx, spent +
amount == daily_budget), and the sequence where five individually-legal charges
cross the aggregate budget. The aggregate case is the one that defeats the drip
attack, so it is asserted as a sequence rather than a single call.
```

**7.**
```
feat: sqlite ledger with rolling-24h spend window

Spend is summed over a rolling 24 hours rather than a calendar day: a calendar
boundary is a free budget reset an attacker can simply wait for.

Adds an explicit budget epoch so a demo can re-arm the window on demand instead
of waiting on a real clock.
```

**8.**
```
feat: broker wiring agent to policy without settlement access

The broker is the only caller of the policy engine and the only module that can
reach payments/. ALLOW settles, DENY records and refuses with no retry
affordance, ESCALATE is stubbed until intents exist.

Adds a test asserting the settlement function is reachable only on the ALLOW
branch, so the boundary is enforced by structure, by grep and by test.
```

**9.**
```
feat: openai agent loop with single request_payment tool

The agent's only spending affordance is request_payment(service, amount, reason).
It has no import path to payments/ and no knowledge that Hedera exists; its
stated reason is carried as untrusted display-only text.
```

---

## Phase 3 — Dashboard

**10.**
```
feat: sse event bus and dashboard state endpoints

Server-Sent Events rather than websockets: the data flows one way, so this drops
the ws dependency and its reconnect handling on a venue network. A snapshot
endpoint covers page load and the stream patches from there.
```

**11.**
```
feat: react dashboard with budget, feed, intent and policy panels

Decision codes render beside the human explanation, which is what makes the
system read as deterministic rather than improvised. policy.json renders
read-only so "policy is data, not code" is visible rather than claimed.
```

---

## Phase 4 — Device and the escalation loop

**12.**
```
feat: hmac-signed single-use payment intents

Intents are server-generated, immutable and consumed atomically. Settlement after
approval reads the stored intent row and never the agent's request object, so a
request mutated after approval cannot redirect an approved payment.

Canonical HMAC input is a fixed pipe-delimited field order rather than JSON, so
the bytes are identical on a microcontroller with no key-ordering assumptions.
```

**13.**
```
feat: device poll and approve endpoints with replay defence

The device polls outbound every two seconds, so no port forwarding is needed on
venue WiFi. Approval requires a matching HMAC, an unseen nonce and an intent that
is still pending and unexpired; the transition to consumed happens in a single
transaction so the same approval cannot settle twice.
```

**14.**
```
feat: esp32 firmware for intent display and physical approval

Verifies the HMAC locally before rendering and refuses to arm the button on a
mismatch, so a tampered intent cannot be approved by a user who trusts the
screen. Displays service, amount, recipient, reason and a countdown.

The device holds no key material that can move funds. It signs an approval for
one specific intent, not a transaction and not a session.
```

---

## Phase 5 — Adversary

**15.**
```
feat: malicious merchant endpoints with injection and drip

Returns genuinely valid data alongside an injected instruction to buy an upsell
from a non-allowlisted service, plus a variant that drips five individually-legal
charges. The injection is written to actually work: an agent that resists it
would make the defence look like it lives in the model.
```

**16.**
```
feat: deterministic injection scanner in signal layer

Regex rules live in policy.json and run over the raw merchant body before the
agent sees it, keeping detection outside the reasoning loop. Deliberately crude:
the claim is that detection is deterministic and outside the model, not that it
is complete.
```

---

## Phase 6 — Rehearsal

**17.**
```
docs: demo script and runbook

Four scenes in order, with the commands for the tamper, replay and swap checks
so they can be run live rather than described.
```
