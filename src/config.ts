import "dotenv/config";
import { readFileSync } from "node:fs";
import type { PolicyConfig } from "./policy/types.js";

export const policy: PolicyConfig = JSON.parse(
  readFileSync(new URL("../policy.json", import.meta.url), "utf8")
);

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  hederaAccountId: process.env.HEDERA_ACCOUNT_ID ?? "",
  hederaPrivateKey: process.env.HEDERA_PRIVATE_KEY ?? "",
  merchantAccountId: process.env.MERCHANT_ACCOUNT_ID ?? "",
  facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
  hederaNetwork: process.env.HEDERA_NETWORK ?? "hedera:testnet",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  deviceHmacSecret: process.env.DEVICE_HMAC_SECRET ?? "",
  port: Number(process.env.PORT ?? 3000),
  merchantPort: Number(process.env.MERCHANT_PORT ?? 4001),
  dbPath: process.env.DB_PATH ?? "./agentpay.db",
};

export { required };
