# Archived Services

These services were part of the on-chain escrow flow (EscrowMaster contract) that is no longer used.

Stereum Pay now handles the full payment lifecycle: quote, order, QR generation, payment verification, and USDC delivery.

## Files

- `escrow.ts` — On-chain EscrowMaster contract interaction (lock, release, expire, deposit)
- `signer.ts` — EIP-712 signature generation for on-chain trade releases

## Why Archived

The current production flow uses Stereum Pay as the sole infrastructure provider. There are no LPs, no on-chain escrow, and no operator-signed releases. These files are kept for reference if the escrow model is revisited in the future.
