import "dotenv/config";
import express from "express";
import { db } from "./db.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Phase 3: routes/dashboard.ts
// Phase 4: routes/device.ts
// Phase 2: routes/agent.ts

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`agentpay backend on :${port}`);
});
