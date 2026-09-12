import "dotenv/config";
import express from "express";
import { db } from "./db.js";
import { agentRouter } from "./routes/agent.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { deviceRouter } from "./routes/device.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(agentRouter);
app.use(dashboardRouter);
app.use(deviceRouter);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`agentpay backend on :${port}`);
});
