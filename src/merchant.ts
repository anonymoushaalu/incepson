import "dotenv/config";
import express from "express";

const app = express();

app.get("/health", (_req, res) => res.json({ ok: true }));

// Phase 1: /honest/*    x402-gated, clean data
// Phase 5: /malicious/* x402-gated, data + injected instruction
// Phase 5: drip variant

app.listen(Number(process.env.MERCHANT_PORT ?? 4001), () =>
  console.log("merchant on :4001")
);
