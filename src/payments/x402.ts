// The ONLY module that imports @x402/* client code. agent/ has no import
// path to this file -- see docs/PLAN.md section 3, "the enforcement boundary".
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactHederaScheme, createClientHederaSigner } from "@x402/hedera";
import { PrivateKey } from "@hiero-ledger/sdk";
import { env, hederaNetwork } from "../config.js";

export interface SettleResult {
  ok: boolean;
  status: number;
  txId?: string;
  body?: unknown;
  error?: string;
}

let httpClient: x402HTTPClient | undefined;
let payingFetch: typeof fetch | undefined;

function getClients(): { httpClient: x402HTTPClient; payingFetch: typeof fetch } {
  if (httpClient && payingFetch) return { httpClient, payingFetch };

  // PrivateKey.fromString() guesses the curve from the string shape and can
  // guess wrong on a raw-hex key with no DER prefix: verified live against a
  // real testnet account where fromString() silently produced an ED25519 key
  // while the account's on-chain key (per the mirror node) is ECDSA_SECP256K1.
  // The mismatch parses fine and signs fine -- it just produces a signature the
  // facilitator's verify step rejects. Fetch the account's real key type rather
  // than assume the portal default (portal now issues both curve types).
  const privateKey = env.hederaKeyType === "ECDSA"
    ? PrivateKey.fromStringECDSA(env.hederaPrivateKey)
    : PrivateKey.fromStringED25519(env.hederaPrivateKey);
  const signer = createClientHederaSigner(env.hederaAccountId, privateKey, {
    network: env.hederaNetwork,
  });

  // x402Client defaults to blocking any asset findDefaultAsset doesn't
  // recognize, capped at $1 -- native HBAR (0.0.0) is not a "default asset"
  // (see payments/x402.ts note above re: ExactHederaScheme.defaultMoneyConversion),
  // so it must be opted into spendControls.allowedAssets explicitly, with an
  // atomic per-payment cap matching policy.json's max_tx_hbar (8 decimals).
  const client = x402Client.fromConfig({
    schemes: [{ network: hederaNetwork, client: new ExactHederaScheme(signer) }],
    spendControls: {
      allowedAssets: [
        {
          network: hederaNetwork,
          asset: "0.0.0",
          maxAmountPerPayment: String(Math.round(env.maxTxHbar * 1e8)),
        },
      ],
    },
  });
  httpClient = new x402HTTPClient(client);
  payingFetch = wrapFetchWithPayment(fetch, client);
  return { httpClient, payingFetch };
}

/**
 * Calls an x402-gated URL, paying automatically if a 402 is returned.
 *
 * Settlement metadata is extracted via x402HTTPClient.getPaymentSettleResponse,
 * never by reading a header name directly: the wire header differs by x402
 * protocol version (v1: X-PAYMENT / PAYMENT-RESPONSE, v2: PAYMENT-SIGNATURE /
 * PAYMENT-RESPONSE-per the installed package source), and the library resolves
 * that internally.
 */
export async function payAndFetch(url: string): Promise<SettleResult> {
  const { httpClient, payingFetch } = getClients();
  const res = await payingFetch(url);

  if (!res.ok) {
    return { ok: false, status: res.status, error: await res.text().catch(() => undefined) };
  }

  let txId: string | undefined;
  try {
    const settle = httpClient.getPaymentSettleResponse((name) => res.headers.get(name));
    txId = settle?.transaction;
  } catch {
    // No settlement header on this response (e.g. the resource was free, or
    // the scheme doesn't echo one) -- non-fatal, res.ok already confirms success.
  }

  const body = await res.json().catch(() => undefined);
  return { ok: true, status: res.status, txId, body };
}
