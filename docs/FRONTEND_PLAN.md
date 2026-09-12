# AgentPay — Frontend & REST Plan

Two parts, planned together, built in order. **Part A (frontend, Three.js)
is what gets built now.** Part B (REST) is specified here so Part A can be
built against its real shape, but implemented after.

Decisions already made (locked):

- **Hero 3D + DOM panels** — one showstopper interactive scene, normal
  Tailwind DOM for everything readable.
- **Frontend-only now, mock the API gaps** — build against real
  `/api/state` + `/api/stream`; everything else behind a marked mock layer
  that Part B swaps out with zero page rewrites.
- **Feature branch + PR** — work on `feat/frontend-3d`, push, open a PR
  against `main`.

---

## Stack additions (verified on npm 2026-09-13)

Cross-checked against
[freshtechbro/claudedesignskills' web3d-integration-patterns skill](https://github.com/freshtechbro/claudedesignskills/blob/main/.claude/skills/web3d-integration-patterns/SKILL.md),
whose decision matrix puts this project squarely in **"Interactive React
apps → R3F + Motion"** / **"Rapid prototyping → R3F + Drei + Motion"** — no
GSAP, since GSAP's scroll-driven timeline model fits marketing sites, not an
SSE-event-driven live dashboard, and running two libraries against the same
object's transform is that skill's explicit anti-pattern #1.

| Package | Version | Why |
|---|---|---|
| `three` | 0.186.0 | The renderer. |
| `@react-three/fiber` | 9.7.0 | React renderer for three. **9.x is the React 19 line.** |
| `@react-three/drei` | 10.7.8 | Camera controls, `Html`, `Line`, `Text`, instancing helpers. |
| `@react-three/postprocessing` | 3.1.1 | Bloom on the "payment settles" moment. Optional, cut first if it costs time. |
| `react-router-dom` | 7.18.3 | Multi-page. |
| `maath` | 0.10.8 | Easing/damping for camera + packet motion. |
| `zustand` | 5.0.15 | Shared 3D scene state (selected node, camera target) — the skill's recommended pattern, kept separate from the SSE data store. |
| `framer-motion` | 13.2.0 | DOM-only micro-interactions (page transitions, the `Html` side-panel, drawer/list animation on `/decisions`). |

**Correction to the initial plan:** the skill's `<motion.mesh>` example
implies `framer-motion-3d`, a *separate* package for animating three.js
primitives directly. Checked before depending on it — `framer-motion-3d`
pins `@react-three/fiber` to the exact old peer `8.2.2` and has had no
release since, so it cannot coexist with our R3F 9.7.0. 3D node hover/select
feedback is instead driven by `maath`'s damp/easing helpers inside
`useFrame`, imperatively — same layered-separation principle, one fewer
library actually touching a three.js object's transform.

**Layered separation**, per the skill: Three.js rendering, animation, and
React UI stay independent layers that don't fight over the same property.
Concretely — `store/useAgentPayStore.ts` (SSE/data) and
`scene/useSceneStore.ts` (Zustand: camera target, selected node, hover
state) are two separate stores; packet motion is driven imperatively inside
`useFrame` off the data store, node click/hover feedback is driven
imperatively inside `useFrame` off the scene store (both via `maath`
easing), and Framer Motion only ever touches DOM elements. Nothing touches
the same three.js object's transform from two places.

**Performance:** `<Canvas frameloop="demand">` with manual `invalidate()`
on state changes, since this scene is mostly idle between SSE events, not a
continuously spinning showcase. `dpr={[1, 2]}` capped pixel ratio.

**Pin constraint worth knowing:** `@react-three/fiber@9.7.0` declares
`react: ">=19 <19.3"`. The project is on React 19.2.8 — compatible, but
React cannot be bumped to 19.3+ without breaking R3F. Do not run a blind
`npm update` on react before the demo.

---

# PART A — FRONTEND (build now)

## Page map

Six routes. Every page reads from one shared SSE-backed store, so any page
is live without its own polling.

| Route | Name | Purpose |
|---|---|---|
| `/` | **Live Flow** | The hero 3D scene. The pitch happens here. |
| `/decisions` | **Decision Ledger** | Every request ever made, filterable, with the reason codes. |
| `/policy` | **Policy** | `policy.json` rendered as an interactive rule chain, not a blob of JSON. |
| `/device` | **Device** | The escalation loop: pending intent, countdown, OLED mirror, approve/tamper/replay state. |
| `/attacks` | **Attacks** | Run the injection and drip scenarios; see them defeated with a visual diff. |
| `/chain` | **On-Chain** | Settled transactions, HashScan links, balance deltas. |

### `/` — Live Flow (the hero)

A 3D directed graph of the actual enforcement path, driven by real SSE
events:

```
 AGENT ──▶ SIGNALS ──▶ POLICY ENGINE ──┬──▶ ALLOW   ──▶ x402 ──▶ HEDERA
                                        ├──▶ ESCALATE ──▶ [ESP32 BUTTON]
                                        └──▶ DENY    ──▶ ✕ (dead end)
```

Interactive, not decorative:

- **Payment packets** are instanced meshes that physically travel the edges
  in real time. On a `decision` SSE event, a packet spawns at AGENT and
  routes down the branch the policy actually chose.
- **Colour is the decision** — emerald ALLOW, amber ESCALATE, red DENY.
  A DENY packet visibly *stops dead* at the wall and dissipates. That
  single animation is the whole security claim, visually.
- **Click any node** → a fixed DOM side panel (not `drei/Html` -- that's for
  labels anchored in 3D space; a fixed inspector reads better as plain,
  selectable text outside the canvas) explains that stage and shows its live
  counters (e.g. click POLICY ENGINE, see the current rule evaluation order
  and how many requests each branch took).
- **Orbit / zoom / pan** via `OrbitControls`, with a "reset view" affordance.
- **The budget wall** is a literal 3D wall on the ALLOW edge whose height
  tracks `spentWindowHbar / daily_budget_hbar`. When the drip attack fills
  it, packets start bouncing off it. Judges *see* the aggregate limit.
- **The ESP32 node pulses** when an intent is pending, with the countdown
  rendered in-scene, and resolves green on approval / grey on timeout.
- Hover any edge → a tooltip naming the module that owns it
  (`broker/`, `payments/x402.ts`) so the enforcement boundary is legible.
- **Degrades:** if WebGL is unavailable, render the DOM fallback panel set
  (the current 4-panel dashboard) instead of a black canvas.

### `/decisions` — Decision Ledger

DOM, not 3D. A dense table: timestamp, service, amount, decision, reason
code, tx link. Filter chips per decision and per reason code. Click a row →
a detail drawer with the signals JSON that produced it. A sparkline of spend
over the window. **This is the page a technical judge will ask for.**

### `/policy` — Policy

`policy.json` shown as a **rule chain** you can step through: five ordered
gates (allowlist → per-tx limit → aggregate budget → injection → anomaly),
each expandable to show its current value and how many requests it has
denied or escalated. A "simulate a request" control lets you type a service
and amount and watch which gate catches it — running the *real* policy
logic, ported to the client as a pure function, with a note that the
authoritative copy is server-side. Raw JSON stays visible below.

### `/device` — Device

The escalation loop made inspectable. Live pending intent with its HMAC and
a countdown ring. An **OLED mirror** — a pixel-accurate 128×64 render of
exactly what the physical screen shows, so the audience can read it without
a camera on the breadboard. Buttons to run the three adversarial checks
(tamper / replay / swap) against the backend and show each rejection with
its error code. A clear statement, on-page, that the device holds no key.

### `/attacks` — Attacks

Two big cards: **Prompt Injection** and **Slow Drain**. Each has a "run it"
button, a live transcript of what the agent actually said and tried, the
injected text highlighted in the merchant response, and the decision that
refused it. The drip card renders the budget filling charge-by-charge and
the exact call where the wall arrived. Both cards end on the same line:
*no transaction was created — verify on HashScan.*

### `/chain` — On-Chain

Every settled transaction with its HashScan link, amount, and the request it
belongs to. Merchant/agent balance deltas pulled from the Hedera mirror
node. An explicit "absence of transactions" panel for the denied scenarios,
because absence is the result being demonstrated.

## Shared architecture

Mapped onto the skill's recommended file structure (`three/scene.js`,
`components/Scene.jsx`, `components/InteractiveObject.jsx`, `store/scene.js`)
adapted to this project's per-page layout:

```
web/src/
  main.tsx                   router mount
  routes/                    one file per page above
  store/
    useAgentPayStore.ts      single SSE subscription -> shared DATA state (replaces useAgentPay)
    useSceneStore.ts         Zustand: selected node, camera target, hover state (3D UI state only)
    api.ts                   ALL network calls; the only file Part B touches
    mock.ts                  marked stand-ins for endpoints that don't exist yet
  scene/
    FlowScene.tsx            the <Canvas> root; frameloop="demand", dpr capped
    nodes/                   Agent, Signals, Policy, Allow, Escalate, Deny, Hedera, Device
                             (each an "InteractiveObject": data-store-driven state,
                              maath-eased click/hover feedback in useFrame)
    Packet.tsx               instanced travelling payments, driven imperatively in useFrame
    BudgetWall.tsx           height-tracks spend
    useFlowEvents.ts         maps SSE events -> spawned packets; calls invalidate()
  components/                DOM: tables, chips, drawers, countdown ring, OledMirror
  policy/evaluate.ts         client port of the pure policy fn (for /policy simulation only)
```

**One SSE connection** for the whole app, in the store. Pages subscribe with
selectors. This matters: six pages each opening `EventSource` would be six
connections and six divergent copies of state.

**`api.ts` is the seam.** Every fetch lives there. Part B's job is to delete
`mock.ts` and repoint `api.ts` at real endpoints. No page component changes.

## Build order (frontend)

| # | Milestone | Verification gate |
|---|---|---|
| A1 | Deps installed, router mounted, 6 empty routes, shared SSE store replacing `useAgentPay` | all routes navigable; existing 4 panels still live on `/` |
| A2 | `api.ts` + `mock.ts` seam; every page's data need declared in one place | typecheck clean; mocked endpoints clearly labelled in UI |
| A3 | 3D scene skeleton: nodes, edges, orbit controls, click-to-inspect | scene renders, 60fps, WebGL fallback works |
| A4 | Packets + SSE wiring: real decisions animate down the right branch | trigger a real DENY, watch the packet stop at the wall |
| A5 | Budget wall + device node + countdown in-scene | drip scenario visibly fills the wall |
| A6 | `/decisions` + `/chain` (DOM, data-dense) | table matches the SQLite ledger exactly |
| A7 | `/policy` interactive rule chain + simulator | simulator agrees with server decision on the same input |
| A8 | `/device` OLED mirror + adversarial check buttons | tamper/replay both show their real error codes |
| A9 | `/attacks` scenario runners with transcripts | both attacks run and visibly fail |
| A10 | Polish: transitions, empty states, mobile/projector sizing, prod build | `npm run build` clean; tested at 1920×1080 projector ratio |

Each milestone is a commit. A PR opens at A4 (first genuinely demoable
state) and stays open, updating, through A10.

---

# PART B — REST (specified now, built after)

Everything the frontend mocks becomes real here. Grouped by what unblocks
what.

## B1 — Read endpoints the pages need

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/requests` | Paginated payment_requests with filters (`decision`, `code`, `service`, `since`). Backs `/decisions`. |
| `GET` | `/api/requests/:id` | One request + its parsed signals + linked intent + tx. Backs the detail drawer. |
| `GET` | `/api/intents` | Intent history with status/consumed_at. Backs `/device` history. |
| `GET` | `/api/chain/transactions` | Settled txs joined to their requests, with HashScan URLs. Backs `/chain`. |
| `GET` | `/api/chain/balances` | Agent + merchant balances via Hedera mirror node, cached. Backs `/chain` deltas. |
| `GET` | `/api/policy/gates` | Per-gate deny/escalate counters. Backs `/policy` counters. |

## B2 — Action endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/policy/simulate` | Run the real server-side `evaluate()` on a hypothetical request; returns the decision without recording or settling. Makes `/policy`'s simulator authoritative instead of a client port. |
| `POST` | `/api/dev/scenario/:name` | Named scenario runner (`autonomous`/`injection`/`drip`) decoupled from the LLM, so `/attacks` works without OpenAI credits. **This also unblocks the demo while the OpenAI key is unfunded.** |
| `POST` | `/api/device/simulate-approve` | Software-approve a pending intent for rehearsal when the ESP32 isn't wired. Must be clearly flagged in the UI as simulated. |

## B3 — Hardening the existing surface

- `/api/stream` — heartbeat comments every 15s so proxies don't idle-close
  the SSE connection mid-demo; `Last-Event-ID` replay so a reconnecting page
  doesn't miss decisions.
- Error envelopes — consistent `{ error, code }` shape; the agent route
  currently leaks a raw stack trace on a 502.
- `/api/state` — include `pendingIntent` history and gate counters so a cold
  page load needs one request, not six.
- Zod (or hand-rolled) validation on every `POST` body; `/api/dev/*` gated
  behind an env flag so they can be disabled for a public deploy.

## B4 — Nice-to-have, cut first

- SQLite indices on `payment_requests(created_at)`, `(decision)`.
- HCS audit topic mirroring (the blueprint's optional T10).
- CSV export of the ledger.

---

## What I need from you (outside my reach)

These are blockers I cannot resolve myself, roughly in the order they bite:

1. **OpenAI credits** — the account returns `429 You have no credits
   remaining`. The agent loop has never executed end-to-end. *Mitigation
   already planned:* B2's `/api/dev/scenario/:name` runs the scenarios
   without the LLM, so the demo survives an unfunded key — but the "agent
   gets fooled by injection" beat is far weaker without a real model call.
2. **ESP32 + SSD1306 + button hardware**, and a physical bring-up pass.
   Flash `firmware/hmac_bringup` first; its serial output must read
   `bcc889a40667cab715e1dc22ad280692cf4bf1c3a280eeeca60d8dbcd8e4b993`. If
   it doesn't, `mbedtls/md.h` differs in your core version and the firmware
   needs adjusting. No Arduino-ESP32 core exists on this machine (verified),
   so I cannot compile it for you.
3. **`gh` CLI is not installed** — I can `git push` (Git Credential Manager
   is configured and `origin/main` is reachable), but I **cannot open the
   PR**. Either install `gh`, or open the PR from GitHub's web UI after I
   push the branch.
4. **`BACKEND_HOST` in `firmware/agentpay_device/secrets.h`** must be your
   machine's LAN IP. It was `10.41.253.175` here and **will differ at the
   venue** — this needs re-checking on venue WiFi and on the hotspot.
5. **A funded Hedera testnet balance.** Both accounts had ~1000 ℏ; each
   demo run spends real testnet HBAR. Top up at portal.hedera.com before
   the event.
6. **Physical rehearsal items** — three timed cold-start runs, one on the
   phone hotspot with the ESP32 joined, the recorded fallback video, and
   `secrets.h`/`.env` values written on paper in case of a reflash.
7. **Decide if `/api/dev/*` ships.** If this repo ever goes public or gets
   deployed, those endpoints let anyone reset your budget. B3 gates them
   behind a flag; you decide the default.
