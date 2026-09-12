import "dotenv/config";
import { payAndFetch } from "../src/payments/x402.js";
import { env } from "../src/config.js";

const url = `http://localhost:${env.merchantPort}/honest/gas-oracle`;

console.log("paying:", url);
const result = await payAndFetch(url);

if (!result.ok) {
  console.error("FAILED", result.status, result.error);
  process.exit(1);
}

console.log("status:", result.status);
console.log("txId:", result.txId ?? "(none in response header)");
console.log("body:", result.body);
console.log(result.txId ? `https://hashscan.io/testnet/transaction/${result.txId}` : "");
