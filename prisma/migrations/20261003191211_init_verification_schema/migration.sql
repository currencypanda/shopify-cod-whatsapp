-- CreateTable
CREATE TABLE "ShopConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappPhoneNumberId" TEXT,
    "whatsappAccessToken" TEXT,
    "whatsappTemplateName" TEXT NOT NULL DEFAULT 'cod_order_verification',
    "autoTagConfirmed" TEXT NOT NULL DEFAULT 'COD-Confirmed',
    "autoTagCancelled" TEXT NOT NULL DEFAULT 'COD-Cancelled',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerName" TEXT,
    "totalAmount" DECIMAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "whatsappMessageId" TEXT,
    "respondedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "VerificationOrder_shop_fkey" FOREIGN KEY ("shop") REFERENCES "ShopConfig" ("shop") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopConfig_shop_key" ON "ShopConfig"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationOrder_shopifyOrderId_key" ON "VerificationOrder"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "VerificationOrder_shop_status_idx" ON "VerificationOrder"("shop", "status");

-- CreateIndex
CREATE INDEX "VerificationOrder_whatsappMessageId_idx" ON "VerificationOrder"("whatsappMessageId");
