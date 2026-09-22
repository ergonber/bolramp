/**
 * Ethereum addresses are case-insensitive. Postgres text comparison is
 * case-sensitive, so every wallet must be normalized before being stored or
 * queried, otherwise lookups fail when the casing differs (EIP-55 vs lower).
 */
export function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}
