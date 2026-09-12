# AgentPay — Execution Plan

Derived from `agentpay-blueprint.pdf`. This file records the **resolved decisions**
(T1–T7 + the allowlist contradiction) and the phase-by-phase build order.

## 0. Verification log — checked 2026-09-12

Re-verified live, because the blueprint's numbers were already stale.

| Claim | Result |
|---|---|
| `x402.org/facilitator` advertises `hedera:testnet` | **YES** — `feePayer: 0.0.9185802` |
| `@x402/core` / `@x402/hedera` | **2.25.0** (blueprint said 2.13.2 — stale) |
| `@x402/express` exists & composes | **YES, 2.25.0** — resolves the §0 "budget an hour" unknown |
| `@hiero-ledger/sdk` | 2.88.0 |
| `openai` | 7.15.0 |
| `better-sqlite3` / `express` | 13.0.3 / 5.2.1 |
| Node | v22.20.0 (LTS, fine) |
| `HBAR_ASSET_ID` | `"0.0.0"` confirmed in package types |
| Subpaths `./exact/client`, `./exact/server` | confirmed in package `exports` |

### Signatures read from installed `.d.mts` — do NOT write these from memory

```ts
createClientHederaSigner(accountId: string, privateKey: PrivateKey,
                         config?: { network?: string; nodeUrl?: string }): ClientHederaSigner
new x402Client(paymentRequirementsSelector?)          // .register(network, schemeClient)
new x402ResourceServer(facilitatorClients?)           // .register(network, schemeServer)
new HTTPFacilitatorClient(config?: FacilitatorConfig) // { url, timeoutMs }
new ExactHederaScheme(config?: HederaServerConfig)    // server side: { defaultAssets? }
paymentMiddleware(routes, server, paywallConfig?, paywall?, syncFacilitatorOnStart?)
```

**Blueprint correction:** §0 said server-side `ExactHederaScheme` is "constructed with a
facilitatorClient". It is not — the facilitator client goes to `x402ResourceServer`.
The scheme takes an optional `{ defaultAssets }`.

**Both the blueprint and the docs-page scrape were wrong about the header name.**
Verified live against the installed package source
(`node_modules/@x402/core/dist/esm/chunk-RAWLCYSQ.mjs`) and against a real
payment on testnet: x402 **v1** sends `X-PAYMENT`; x402 **v2** — what Hedera's
facilitator actually speaks — sends **`PAYMENT-SIGNATURE`**, and the response
header is `PAYMENT-REQUIRED` / `PAYMENT-RESPONSE`, not `X-Payment-Response`.
Never read these header names directly — use `x402HTTPClient` /
`x402HTTPResourceServer`, which resolve them per-version internally.

**Real payment settled during Phase 1, live-corrected findings:**

1. **Pricing native HBAR requires an explicit atomic `AssetAmount`, not `Money`.**
   `ExactHederaScheme.defaultMoneyConversion` (server) throws if a Money-string
   price would resolve to `0.0.0` -- Money/`defaultAssets` only targets HTS
   tokens. Use `price: { asset: "0.0.0", amount: "<atomic-tinybar-string>" }`.
   `AssetAmount.amount` is NOT decimal-scaled by the library -- 0.02 HBAR must
   be written as `"2000000"` (8 decimals), not `"0.02"`.
2. **The root `@x402/hedera` export is the CLIENT scheme.** The server scheme
   is only at the `@x402/hedera/exact/server` subpath. Importing
   `ExactHederaScheme` from the package root on the server silently grabs the
   client class (which requires a signer, not a config) -- TypeScript catches
   this as a constructor-arity error, but only if you don't cast it away.
3. **`x402Client`'s spend controls block any non-default asset by default**,
   including native HBAR. `new x402Client().register(...)` alone will reject
   every Hedera HBAR payment with "All payment requirements were rejected by
   spendControls". Use `x402Client.fromConfig({ schemes, spendControls:
   { allowedAssets: [{ network, asset: "0.0.0", maxAmountPerPayment:
   "<atomic>" }] } })`. The cap must also be an atomic integer string.
4. **`PrivateKey.fromString()` can silently guess the wrong curve.** Verified
   against a real testnet account: `fromString()` returned a validly-shaped
   ED25519 key with no error, while the account's actual on-chain key (per
   the mirror node, `GET /accounts/{id}`) was `ECDSA_SECP256K1`. The mismatched
   key signs without error and produces a signature the facilitator's verify
   step rejects (`invalid_exact_hedera_payload_signature_invalid`) -- a
   failure mode with no client-side symptom until the live payment attempt.
   Always fetch the account's real key type from the mirror node rather than
   assume a curve, and parse with the matching `fromStringECDSA` /
   `fromStringED25519`.
5. **`@x402/hedera` pins its own nested `@hiero-ledger/sdk`** as a regular
   (non-peer) dependency. Installing a different top-level version produces
   two structurally-identical but nominally distinct `PrivateKey` classes and
   a confusing TS2345 type error. Pin the top-level install to match
   `@x402/hedera`'s resolved version (`npm ls @hiero-ledger/sdk` after
   installing `@x402/hedera` to find it) so npm dedupes to one copy.
6. **`@x402/fetch` is the missing piece for the client side** -- the blueprint
   never named it. `wrapFetchWithPayment(fetch, client)` is the sanctioned way
   to get automatic 402-retry-with-payment; the low-level `x402HTTPClient` is
   for manual control (used here only to extract `getPaymentSettleResponse`
   after `wrapFetchWithPayment` already paid).

Live proof: https://hashscan.io/testnet/transaction/0.0.9185802-1789208532-496960451
(SUCCESS, CRYPTOTRANSFER, merchant account credited exactly 2,000,000 tinybar).

---

## 1. Resolved decisions

### T2 — amount anomaly: p95 with soft-limit fallback
`soft_limit_hbar` applies until a service has `p95_min_sample` settled transactions;
above that, the real p95 for that service takes over. Signal renamed
`amount_anomalous` so the name never overstates what ran.

### T3 — budget window: rolling 24h + explicit reset
`budget_window: "rolling_24h"`. **Constraint from user: the demo must never be blocked
by a limit I can't clear.** Therefore `POST /api/dev/reset-day` lands in **Phase 2**,
not Phase 5 — it stamps a `budget_epoch` and daily spend only counts settlements after
it. One click re-arms every scenario. Never gated behind a real clock.

### Allowlist contradiction — allowlist is the hard boundary
`unknown_service` **dropped** from `escalate_on`. Not on `service_allowlist` → DENY,
no appeal. Consequence: the **button demo is driven by `amount_anomalous`**, so the
numbers must make that fire (see policy.json).

### T6 — OpenAI
`openai` 7.15.0, tool-calling loop. Single tool: `request_payment`.

### T1 — injection detection: deterministic regex, rules live in policy.json
Scans the **raw merchant response body before the agent sees it**. Crude on purpose.
The claim is "detection is deterministic and outside the model", not "we catch everything".

### T7 — timeout: agent told `ESCALATION_TIMEOUT`, no retry affordance
### T4 — four scenes: autonomous → button → injection → drip

---

## 2. Number design (this is why the demo works)

```
max_tx_hbar        0.10   hard DENY above
soft_limit_hbar    0.05   ESCALATE above  → this drives the button
daily_budget_hbar  0.30   rolling 24h aggregate

scene 1  0.02  → ALLOW      (below soft limit, settles autonomously)
scene 2  0.08  → ESCALATE   (soft<0.08<max) → OLED → press → settles
scene 3  0.05  → DENY       NOT_ALLOWLISTED + injection_detected
scene 4  5 × 0.08 = 0.40 vs 0.30 budget → 3 settle, 4th DENY OVER_DAILY_BUDGET
```

**Evaluation order is itself a security property — say it in the pitch:**
hard denials first (allowlist → per-tx limit → aggregate budget), *then* escalation
signals. A request that is both anomalous and over budget must DENY, never escalate —
otherwise a human can be socially engineered into approving what policy already forbids.

---

## 3. Phases

| Phase | Deliverable | Gate |
|---|---|---|
| 0 | repo, deps, config, schema | `npm run dev` boots, /health 200 |
| 1 | rails: one real HBAR payment | HashScan SUCCESS receipt |
| 2 | policy engine + boundary + reset | tests green, DENY = 0 network |
| 3 | dashboard (SSE) | 2 tabs live, no refresh |
| 4 | ESP32 escalation loop | tamper/replay/swap pass |
| 5 | adversary: injection + drip | both denied, visible reason |
| 6 | rehearsal | 3 clean runs + video |

Phase 1 must be first and must finish Day 1. **If it slips past midday, reassess scope
— do not push on.** The policy engine (Phase 2) has zero network dependencies: if the
facilitator is down, build that while you wait.

**Rework warning:** decide the HMAC canonical string once, on paper, before writing
either side — it is implemented twice, in two languages.
`intent_id|service|recipient|amount|reason|expires_at`

---

## 4. Commit sequence

```
p0  chore: scaffold agentpay workspace and toolchain
p0  chore: add sqlite schema and typed config loader
p1  feat: x402-gated merchant endpoint on hedera testnet
p1  feat: x402 hedera payment client
p2  feat: deterministic policy engine with injected clock
p2  test: cover policy branches, boundaries and drip aggregate
p2  feat: sqlite ledger with rolling-24h spend window
p2  feat: broker wiring agent to policy without settlement access
p2  feat: openai agent loop with single request_payment tool
p3  feat: sse event bus and dashboard state endpoints
p3  feat: react dashboard with budget, feed, intent and policy panels
p4  feat: hmac-signed single-use payment intents
p4  feat: device poll and approve endpoints with replay defence
p4  feat: esp32 firmware for intent display and physical approval
p5  feat: malicious merchant endpoints with injection and drip
p5  feat: deterministic injection scanner in signal layer
p6  docs: demo script and runbook
```

Each ends with:
```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```
