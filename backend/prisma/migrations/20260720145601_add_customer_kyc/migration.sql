-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wallet" TEXT NOT NULL,
    "stereumCustomerId" TEXT,
    "name" TEXT NOT NULL,
    "lastname" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'CI',
    "documentNumber" TEXT NOT NULL,
    "complementNumber" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BO',
    "stateOfResidence" TEXT NOT NULL,
    "economicActivity" TEXT,
    "sourceOfFunds" TEXT,
    "destinationOfFunds" TEXT,
    "incomeLevel" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'pending',
    "kycValidatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_wallet_key" ON "Customer"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_stereumCustomerId_key" ON "Customer"("stereumCustomerId");

-- CreateIndex
CREATE INDEX "Customer_documentNumber_idx" ON "Customer"("documentNumber");

-- CreateIndex
CREATE INDEX "Customer_wallet_idx" ON "Customer"("wallet");
