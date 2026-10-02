const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 137);

/**
 * Polygon explorer URL for a transaction hash.
 * 137 = Polygon mainnet, 80002 = Amoy testnet.
 */
export function txExplorerUrl(hash: string): string {
  const base =
    CHAIN_ID === 137
      ? "https://polygonscan.com/tx/"
      : "https://amoy.polygonscan.com/tx/";
  return `${base}${hash}`;
}
