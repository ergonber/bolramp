-- TestNet and MainNet are separate Stereum environments: a stereumCustomerId
-- created in TestNet is NOT valid in MainNet. Before going live, invalidate the
-- TestNet customer IDs so the KYC flow re-creates each customer under MainNet.
--
--   psql "$DATABASE_URL" -f backend/prisma/manual/20261002_reset_kyc_for_mainnet.sql

UPDATE "Customer"
SET "stereumCustomerId" = NULL,
    "kycStatus" = 'pending',
    "kycValidatedAt" = NULL;
