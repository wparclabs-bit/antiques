-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('FURNITURE', 'CERAMICS_PORCELAIN', 'ART_PAINTINGS', 'BOOKS', 'WATCH', 'PEN');

-- CreateEnum
CREATE TYPE "ItemState" AS ENUM ('DRAFT', 'CATALOGED', 'LISTED', 'RESERVED', 'SOLD', 'SHIPPED');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "state" "ItemState" NOT NULL DEFAULT 'DRAFT',
    "fiftyYearsOld" BOOLEAN NOT NULL DEFAULT true,
    "conditionNotes" TEXT,
    "provenance" TEXT,
    "costBasisIdr" INTEGER,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_state_idx" ON "Item"("state");

-- CreateIndex
CREATE INDEX "Item_category_idx" ON "Item"("category");

-- CreateIndex
CREATE INDEX "Photo_itemId_idx" ON "Photo"("itemId");

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
