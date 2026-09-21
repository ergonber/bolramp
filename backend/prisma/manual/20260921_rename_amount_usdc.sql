-- Manual migration: rename Trade.amountUSDT -> amountUSDC and update the
-- default asset for RateSnapshot.
--
-- WHY MANUAL: the committed Prisma migrations were generated for SQLite while
-- the datasource provider is PostgreSQL, so `prisma migrate deploy` cannot be
-- used against the real database. Deployments currently use `prisma db push`,
-- which does NOT detect column renames and would drop/recreate the column
-- (data loss). Run this script once against PostgreSQL BEFORE deploying the
-- schema change with `amountUSDC`.
--
--   psql "$DATABASE_URL" -f backend/prisma/manual/20260921_rename_amount_usdc.sql

ALTER TABLE "Trade" RENAME COLUMN "amountUSDT" TO "amountUSDC";

ALTER TABLE "RateSnapshot" ALTER COLUMN "asset" SET DEFAULT 'USDC';
