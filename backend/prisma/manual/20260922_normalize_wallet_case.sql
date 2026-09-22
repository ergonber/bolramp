-- Ethereum addresses are case-insensitive, but Postgres text comparison is
-- case-sensitive. Normalize all stored wallets to lowercase so lookups by
-- wallet (KYC, quote, QR, history) always match.
--
--   psql "$DATABASE_URL" -f backend/prisma/manual/20260922_normalize_wallet_case.sql

UPDATE "Customer" SET wallet = lower(wallet);
UPDATE "Trade" SET "userWallet" = lower("userWallet"), "lpAddress" = lower("lpAddress");
