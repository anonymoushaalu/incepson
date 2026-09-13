import { JsonRpcProvider, Contract } from "ethers";

// Chainlink's real, deployed HBAR/USD price feed on Hedera testnet, read
// through Hedera's EVM JSON-RPC relay (Hashio) -- the same
// AggregatorV3Interface contract shape as any Chainlink feed on any EVM
// chain. See https://docs.hedera.com/hedera/open-source-solutions/oracle-networks/chainlink-oracles
const HASHIO_TESTNET_RPC = "https://testnet.hashio.io/api";
const HBAR_USD_FEED_ADDRESS = "0x59bC155EB6c6C415fE43255aF66EcF0523c92B4a";

const AGGREGATOR_V3_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
];

let cached: { at: number; value: number } | null = null;
const CACHE_MS = 30_000;

/** Live HBAR/USD price from Chainlink's testnet feed, or null if the RPC
 *  call fails (venue WiFi, relay hiccup) -- callers must treat this the
 *  same way as hedera-mirror.ts's balance lookups: best-effort, never
 *  blocking the actual payment/policy path, which has nothing to do with
 *  USD conversion. */
export async function fetchHbarUsdPrice(): Promise<number | null> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const provider = new JsonRpcProvider(HASHIO_TESTNET_RPC);
    const feed = new Contract(HBAR_USD_FEED_ADDRESS, AGGREGATOR_V3_ABI, provider);
    const [decimals, roundData] = await Promise.all([feed.decimals(), feed.latestRoundData()]);
    const price = Number(roundData.answer) / 10 ** Number(decimals);
    cached = { at: Date.now(), value: price };
    return price;
  } catch {
    return null;
  }
}
