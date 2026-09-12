import "dotenv/config";
import express from "express";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { paymentMiddleware } from "@x402/express";
// The package root re-exports the CLIENT-side ExactHederaScheme. The server
// scheme lives at the explicit subpath -- importing from the root here would
// silently pull in the wrong class (requires a signer, not a HederaServerConfig).
import { ExactHederaScheme } from "@x402/hedera/exact/server";
import { env, hederaNetwork } from "./config.js";

const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));

const facilitator = new HTTPFacilitatorClient({ url: env.facilitatorUrl });
const resourceServer = new x402ResourceServer(facilitator).register(
  hederaNetwork,
  new ExactHederaScheme()
);

// Native HBAR (asset 0.0.0) requires an explicit AssetAmount price: a plain
// Money string can only resolve to a configured HTS token, and the scheme
// throws if that resolves to 0.0.0 -- see ExactHederaScheme.defaultMoneyConversion
// in the installed package source (node_modules/@x402/hedera/dist/esm/exact/server/index.mjs).
//
// AssetAmount.amount is passed through by parsePrice with NO decimal-to-atomic
// conversion (unlike Money, which goes through convertToTokenAmount), and the
// client's spendControls asset-cap check requires an integer atomic string
// (/^\d+$/) -- a decimal HBAR string like "0.02" is silently rejected as
// non-atomic. HBAR has 8 decimals, so 0.02 HBAR = 2000000 tinybar.
app.use(
  paymentMiddleware(
    {
      "/honest/gas-oracle": {
        accepts: {
          scheme: "exact",
          network: hederaNetwork,
          payTo: env.merchantAccountId,
          price: { asset: "0.0.0", amount: String(0.02 * 1e8) }, // 2000000 tinybar
        },
      },
    },
    resourceServer
  )
);

app.get("/honest/gas-oracle", (_req, res) => {
  res.json({
    source: "gas-oracle.local",
    gas_price_gwei: 31,
    updated: new Date().toISOString(),
  });
});

// Phase 5: /malicious/* x402-gated, data + injected instruction
// Phase 5: drip variant

app.listen(env.merchantPort, () => console.log(`merchant on :${env.merchantPort}`));
