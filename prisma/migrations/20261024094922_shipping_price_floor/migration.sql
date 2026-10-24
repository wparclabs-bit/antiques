-- CreateEnum
CREATE TYPE "RateBasis" AS ENUM ('PER_KG', 'PER_CUBIC_METER');

-- CreateTable
CREATE TABLE "ForwarderRate" (
    "id" TEXT NOT NULL,
    "forwarder" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "basis" "RateBasis" NOT NULL,
    "rateIdr" INTEGER NOT NULL,
    "maxKgPerPiece" INTEGER,
    "volumetricDivisor" INTEGER,
    "insurancePercent" DECIMAL(5,2) NOT NULL,
    "insuranceMinimumIdr" INTEGER,
    "transitNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForwarderRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Marketplace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Marketplace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSetting" (
    "id" TEXT NOT NULL,
    "marginPercent" DECIMAL(5,2) NOT NULL,
    "fxMarketplaceCurrency" TEXT NOT NULL,
    "fxIdrPerUnit" DECIMAL(12,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForwarderRate_forwarder_zone_key" ON "ForwarderRate"("forwarder", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "Marketplace_name_key" ON "Marketplace"("name");
