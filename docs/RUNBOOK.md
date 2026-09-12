# AgentPay — Inline Command Runbook

Copy-paste, in order. Every block is a real command. Bash (Git Bash on Windows).

Full commit messages (with trailers) are in `docs/COMMITS.md`.

---

## PHASE 0 — Scaffold

```bash
cd a:/eth/incepson

# --- first action of every working day: is the facilitator alive? ---
curl -s https://x402.org/facilitator/supported | grep -o 'hedera:testnet' \
  || echo "BLOCKED -> fall back to https://api.testnet.blocky402.com"

npm init -y
npm pkg set type=module private=true
npm pkg set scripts.dev="tsx watch src/index.ts"
npm pkg set scripts.merchant="tsx watch src/merchant.ts"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.build="tsc -p tsconfig.json"
npm pkg set scripts.start="node dist/index.js"

# let npm resolve every version. never type a version string from memory.
npm i express better-sqlite3 dotenv openai \
      @x402/core @x402/hedera @x402/express @hiero-ledger/sdk
npm i -D typescript tsx vitest @types/express @types/better-sqlite3 @types/node

mkdir -p src/{policy,signals,intents,payments,ledger,broker,agent,routes} \
         firmware/agentpay_device docs scripts
```

`tsconfig.json` — note **`nodenext`**, not `bundler`. The `@x402/*` subpath exports
(`@x402/hedera/exact/client`) resolve cleanly under nodenext; bundler fights them.

```json
{ "compilerOptions": {
    "target": "ES2022", "module": "nodenext", "moduleResolution": "nodenext",
    "outDir": "dist", "rootDir": "src", "strict": true,
    "esModuleInterop": true, "skipLibCheck": true, "resolveJsonModule": true },
  "include": ["src"] }
```

`.gitignore`: `node_modules/`, `dist/`, `.env`, `*.db`, `*.db-wal`, `*.db-shm`,
`firmware/agentpay_device/secrets.h`

### policy.json — the security claim, as data

Numbers chosen so every scene fires. `soft_limit < max_tx` is what drives the button.

```json
{
  "agent_id": "research-agent-01",
  "max_tx_hbar": 0.10,
  "soft_limit_hbar": 0.05,
  "daily_budget_hbar": 0.30,
  "budget_window": "rolling_24h",
  "p95_min_sample": 20,
  "service_allowlist": ["gas-oracle.local", "eth-price.local"],
  "escalate_on": ["injection_detected", "amount_anomalous"],
  "escalation_timeout_sec": 60,
  "injection_patterns": [
    "(?i)\\b(purchase|buy|pay|subscribe|upgrade)\\b.{0,40}?\\b(hbar|premium|upsell|plan)\\b",
    "(?i)\\bignore\\b.{0,30}?\\b(previous|prior|above)\\b.{0,20}?\\binstructions?\\b",
    "(?i)\\b(send|transfer|remit)\\b.{0,30}?\\b0\\.0\\.[0-9]{3,}\\b"
  ]
}
```

These are **tested** (7/7: fires on 4 attack payloads, silent on 3 honest ones,
including honest data that legitimately contains a `0.0.x` account id).

Two non-obvious details, both of which cost a working scanner if you get them wrong:

- **Use `.{0,N}?`, not `[^.]{0,N}`.** A `[^.]` gap forbids dots, so
  `"send 0.5 HBAR to 0.0.998877"` never matches — the amount `0.5` contains a dot.
- **JS has no `(?i)` inline flag.** Strip the prefix and pass the flag:
  `new RegExp(p.replace(/^\(\?i\)/, ""), "i")`. Left in, it is parsed as a literal
  group and every pattern silently stops matching.

Pin this behaviour with a test in Phase 5 — a regex that never fires is a silent
demo failure, and you will not notice it from the dashboard.

### .env

```bash
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=
MERCHANT_ACCOUNT_ID=0.0.xxxxx
X402_FACILITATOR_URL=https://x402.org/facilitator
HEDERA_NETWORK=hedera:testnet
OPENAI_API_KEY=
DEVICE_HMAC_SECRET=        # openssl rand -hex 32  -> same value into firmware/secrets.h
PORT=3000
MERCHANT_PORT=4001
DB_PATH=./agentpay.db
```

Two funded testnet accounts from https://portal.hedera.com — agent + merchant.

---

## PHASE 1 — Rails (must finish Day 1)

Build `src/merchant.ts` with `paymentMiddleware`, and `src/payments/x402.ts` with the
client. Signatures are in `docs/PLAN.md` §0 — read the installed `.d.mts`, never memory.

```bash
npm run merchant &                          # :4001
curl -i localhost:4001/honest/gas-oracle    # EXPECT 402 + PaymentRequirements + feePayer
npx tsx scripts/smoke.ts                    # EXPECT 200 + data + txId
```

Verify on the ledger, not in your logs:

```bash
start "https://hashscan.io/testnet/transaction/<TX_ID>"
curl -s "https://testnet.mirrornode.hedera.com/api/v1/accounts/$MERCHANT_ACCOUNT_ID" \
  | grep -o '"balance":[0-9]*'
```

**Screenshot HashScan.** That screenshot is your fallback if venue WiFi dies.

---

## PHASE 2 — Policy engine + enforcement boundary

Write the resolved decisions into a comment at the top of `engine.ts` first.

```bash
npm test                            # every branch + boundaries + drip aggregate
grep -rn 'payments/' src/agent/     # MUST return nothing        <- the boundary
grep -rn 'import'    src/policy/    # MUST show only ./types.js  <- purity
```

The reset control that keeps the demo re-runnable (no clock waiting, ever):

```bash
curl -X POST localhost:3000/api/dev/reset-day
```

Prove a denial costs nothing on-chain:

```bash
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' \
     -d '{"scenario":"over-limit"}'
node scripts/db-query.mjs "SELECT decision,decision_code,settled,tx_id FROM payment_requests ORDER BY created_at DESC LIMIT 3;"
# every DENY row: settled=0, tx_id NULL
```

---

## PHASE 3 — Dashboard

```bash
npm create vite@latest web -- --template react-ts
cd web && npm i && npm i tailwindcss @tailwindcss/vite && cd ..
echo '@import "tailwindcss";' > web/src/index.css
cd web && npm run dev        # :5173, proxying /api -> :3000
```

Verify: two tabs, trigger a request, both move within a second. Kill the backend,
restart, reload — history survives (it is in SQLite, not memory).

---

## PHASE 4 — Device

Decide the HMAC canonical string **before writing either side**. Paste this comment
into both `src/intents/index.ts` and `agentpay_device.ino`:

```
// HMAC input, byte-identical both sides. Fixed order. No JSON key ordering.
// intent_id|service|recipient|amount|reason|expires_at
// amount formatted with exactly 8 decimals. HMAC-SHA256, lowercase hex.
```

Hardware bring-up first — do this Day 1 evening while something installs:

```bash
arduino-cli core install esp32:esp32
arduino-cli lib install "Adafruit SSD1306" "Adafruit GFX Library"
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/agentpay_device
arduino-cli upload  --fqbn esp32:esp32:esp32 -p COM5 firmware/agentpay_device
arduino-cli monitor -p COM5 -c baudrate=115200
```

A dead OLED found on Day 3 ends the project; found on Day 1 it costs a trip to a shop.

The three tests that are simultaneously the demo:

```bash
# 1 TAMPER - flip a byte server-side; device must display tamper and refuse to arm
# 2 REPLAY
curl -X POST localhost:3000/device/approve -H 'content-type: application/json' \
     -d '{"intent_id":"<ID>","nonce":"<USED>","hmac":"<H>"}'   # rejected: nonce seen
#   same intent, fresh nonce -> also rejected: already CONSUMED
# 3 SWAP - approve, mutate the agent request object, then settle:
#   the settled amount must still match the INTENT row.
node scripts/db-query.mjs "SELECT intent_id,status,consumed_at FROM intents;"
```

---

## PHASE 5 — Adversary

**Let the agent actually be fooled.** Do not filter the injection out of its context —
an agent that resists makes the defence look like it lives in the model.

```bash
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' -d '{"scenario":"injection"}'
curl -X POST localhost:3000/api/dev/reset-day
curl -X POST localhost:3000/api/agent/run -H 'content-type: application/json' -d '{"scenario":"drip"}'
```

Expect 3 settle, 4th `OVER_DAILY_BUDGET`. Watching the budget bar fill and then the
wall arrive is the most persuasive thing on the screen.

The ground-truth query — run after **every** rehearsal:

```bash
node scripts/db-query.mjs "SELECT COUNT(*) FROM payment_requests WHERE decision='DENY' AND (settled=1 OR tx_id IS NOT NULL);"
# MUST be 0. this is proof the enforcement boundary held.
```

Then confirm the *absence* of those transactions on HashScan. Absence is the result.

---

## PHASE 6 — Rehearsal

```bash
npm run build && (cd web && npm run build)        # tsc clean, web clean
ipconfig | grep IPv4                              # ESP32 needs LAN IP, not localhost
```

- 3 timed runs from cold start, **one on the phone hotspot** with the ESP32 joined.
- Record the video. It is your insurance.
- Write `secrets.h` + `.env` values **on paper** in case you must reflash.
- Spare USB **data** cable (not a charge-only one).

Scene order — 2 is the emotional peak, do not rush it, let the room watch the OLED:

1. autonomous settlement 2. escalation + physical press 3. injection denied 4. drip denied

---

## Daily smoke

```bash
curl -s localhost:3000/health
curl -i localhost:4001/honest/gas-oracle | head -1     # 402
curl -i localhost:3000/device/pending    | head -1     # 204 when idle
grep -rn 'payments/' src/agent/                        # nothing
node scripts/db-query.mjs "SELECT COUNT(*) FROM payment_requests WHERE decision='DENY' AND settled=1;"  # 0
```
