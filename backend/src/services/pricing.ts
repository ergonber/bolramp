import { getEnv } from "../config/env.js";

interface BinanceP2PResponse {
  code: string;
  message: string | null;
  data: Array<{
    adv: {
      advNo: string;
      price: string;
      volume: string;
      minLimit: string;
      maxLimit: string;
    };
    advertiser: {
      nickName: string;
    };
  }>;
}

let cachedRate: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

/**
 * Get USDC/BOB rate from Binance P2P (real market price)
 */
export async function getBinanceP2PRate(): Promise<number> {
  const now = Date.now();

  if (cachedRate && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const response = await fetch(
      "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiat: "BOB",
          page: 1,
          rows: 20,
          tradeType: "BUY",
          asset: "USDC",
        }),
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      throw new Error(`Binance P2P API error: ${response.status}`);
    }

    const result = (await response.json()) as BinanceP2PResponse;

    if (result.code !== "000000" || !result.data || result.data.length === 0) {
      throw new Error("No P2P rates available");
    }

    const prices = result.data
      .map((item) => parseFloat(item.adv.price))
      .filter((p) => !isNaN(p) && p > 0);

    if (prices.length === 0) {
      throw new Error("No valid P2P prices found");
    }

    const medianPrice = prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)];

    cachedRate = medianPrice;
    cacheTimestamp = now;

    return medianPrice;
  } catch {
    const fallbackRate = 10.55;
    cachedRate = fallbackRate;
    cacheTimestamp = now;
    return fallbackRate;
  }
}

/**
 * Calculate quote using Binance P2P rate + spread + fee
 */
export function calculateQuote(
  amountBOB: number,
  p2pRate: number,
  lpSpreadBps: number,
  platformFeeBps: number,
): {
  amountUSDT: number;
  rate: number;
  lpSpread: number;
  platformFee: number;
} {
  const rateWithSpread = p2pRate * (1 + lpSpreadBps / 10_000);
  const amountUSDT = amountBOB / rateWithSpread;
  const feeAmount = amountUSDT * (platformFeeBps / 10_000);

  return {
    amountUSDT: amountUSDT - feeAmount,
    rate: rateWithSpread,
    lpSpread: lpSpreadBps,
    platformFee: platformFeeBps,
  };
}
