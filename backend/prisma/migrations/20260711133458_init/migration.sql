-- CreateTable
CREATE TABLE "Trade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tradeId" INTEGER,
    "userWallet" TEXT NOT NULL,
    "lpAddress" TEXT NOT NULL,
    "amountUSDT" REAL NOT NULL,
    "amountBOB" REAL NOT NULL,
    "rate" REAL NOT NULL,
    "lpSpread" INTEGER NOT NULL DEFAULT 50,
    "platformFee" INTEGER NOT NULL DEFAULT 50,
    "userOpId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "releaseTxHash" TEXT,
    "qrData" TEXT,
    "qrCodeBase64" TEXT,
    "quoteId" TEXT,
    "rateAtQuote" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lockedAt" DATETIME,
    "releasedAt" DATETIME,
    "expiredAt" DATETIME
);

-- CreateTable
CREATE TABLE "LP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "dailyLimit" REAL,
    "totalDeposited" REAL NOT NULL DEFAULT 0,
    "totalLocked" REAL NOT NULL DEFAULT 0,
    "totalReleased" REAL NOT NULL DEFAULT 0,
    "totalExpired" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BOB',
    "asset" TEXT NOT NULL DEFAULT 'USDT',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "tradeId" INTEGER,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Trade_tradeId_key" ON "Trade"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_userOpId_key" ON "Trade"("userOpId");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_quoteId_key" ON "Trade"("quoteId");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_userWallet_idx" ON "Trade"("userWallet");

-- CreateIndex
CREATE INDEX "Trade_lpAddress_idx" ON "Trade"("lpAddress");

-- CreateIndex
CREATE INDEX "Trade_userOpId_idx" ON "Trade"("userOpId");

-- CreateIndex
CREATE INDEX "Trade_quoteId_idx" ON "Trade"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "LP_wallet_key" ON "LP"("wallet");

-- CreateIndex
CREATE INDEX "LP_wallet_idx" ON "LP"("wallet");

-- CreateIndex
CREATE INDEX "RateSnapshot_source_timestamp_idx" ON "RateSnapshot"("source", "timestamp");

-- CreateIndex
CREATE INDEX "WebhookLog_processed_idx" ON "WebhookLog"("processed");

-- CreateIndex
CREATE INDEX "WebhookLog_tradeId_idx" ON "WebhookLog"("tradeId");
