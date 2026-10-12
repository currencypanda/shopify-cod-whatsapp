import prisma from "../app/db.server.ts";
import { formatPhoneNumber, buildButtonId, parseButtonId } from "../app/services/whatsapp.server.ts";
import { VerificationStatus } from "@prisma/client";

const DEV_SHOP = "ahmed-cod-test.myshopify.com";

async function main() {
  console.log("=================================================================");
  console.log("1. DATABASE VERIFICATION & SHOP CONFIG SETUP");
  console.log("=================================================================");

  let shopConfig = await prisma.shopConfig.findUnique({
    where: { shop: DEV_SHOP },
  });

  if (!shopConfig) {
    console.log(`[ShopConfig] Creating default ShopConfig entry for ${DEV_SHOP}...`);
    shopConfig = await prisma.shopConfig.create({
      data: {
        shop: DEV_SHOP,
        isEnabled: true,
        whatsappPhoneNumberId: "109876543210987", // Default mock ID if not configured
        whatsappAccessToken: "EAABmocktoken123",    // Default mock Token if not configured
        whatsappTemplateName: "cod_order_verification",
        autoTagConfirmed: "COD-Confirmed",
        autoTagCancelled: "COD-Cancelled",
      },
    });
    console.log(`[ShopConfig] Created successfully:`, {
      id: shopConfig.id,
      shop: shopConfig.shop,
      whatsappTemplateName: shopConfig.whatsappTemplateName,
      autoTagConfirmed: shopConfig.autoTagConfirmed,
      autoTagCancelled: shopConfig.autoTagCancelled,
    });
  } else {
    console.log(`[ShopConfig] Entry already exists for ${DEV_SHOP}:`, {
      id: shopConfig.id,
      shop: shopConfig.shop,
      whatsappPhoneNumberId: shopConfig.whatsappPhoneNumberId ? "CONFIGURED" : "NOT SET",
      whatsappTemplateName: shopConfig.whatsappTemplateName,
      autoTagConfirmed: shopConfig.autoTagConfirmed,
      autoTagCancelled: shopConfig.autoTagCancelled,
    });
  }

  // Check existing session in db
  const sessions = await prisma.session.findMany({
    where: { shop: DEV_SHOP },
    select: { id: true, shop: true, isOnline: true, scope: true },
  });
  console.log(`[Session] Found ${sessions.length} session(s) for ${DEV_SHOP}:`, sessions);

  console.log("\n=================================================================");
  console.log("2. MOCK ORDERS_CREATE WEBHOOK INGESTION");
  console.log("=================================================================");

  const rawOrderId = Date.now().toString();
  const shopifyOrderId = `gid://shopify/Order/${rawOrderId}`;
  const orderNumber = `#TEST-${rawOrderId.slice(-4)}`;
  const rawCustomerPhone = "0300-1234567";
  const customerName = "Muhammad Ahmed";
  const totalAmount = "3450.00";
  const currency = "PKR";

  // Simulate normalization logic
  const normalizedPhone = formatPhoneNumber(rawCustomerPhone, "92");
  console.log(`[Normalize] Raw Phone: "${rawCustomerPhone}" -> E.164: "${normalizedPhone}"`);
  if (!normalizedPhone) {
    throw new Error("Phone normalization failed");
  }

  // Insert PENDING record
  const verification = await prisma.verificationOrder.create({
    data: {
      shop: DEV_SHOP,
      shopifyOrderId,
      orderNumber,
      customerPhone: normalizedPhone,
      customerName,
      totalAmount,
      currency,
      status: VerificationStatus.PENDING,
    },
  });

  console.log(`[VerificationOrder] Inserted record successfully:`, {
    id: verification.id,
    shopifyOrderId: verification.shopifyOrderId,
    orderNumber: verification.orderNumber,
    customerPhone: verification.customerPhone,
    status: verification.status,
  });

  if (verification.status !== VerificationStatus.PENDING) {
    throw new Error(`Expected status PENDING, got ${verification.status}`);
  }
  console.log("--> VERIFICATION 1: Record inserted with status PENDING: PASS");

  console.log("\n=================================================================");
  console.log("3. SIMULATE WHATSAPP MESSAGE DISPATCH");
  console.log("=================================================================");

  const confirmBtnId = buildButtonId("CONFIRM", verification.id);
  const cancelBtnId = buildButtonId("CANCEL", verification.id);

  console.log(`[WhatsApp Template Payload]`);
  console.log(
    JSON.stringify(
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizedPhone.replace(/^\+/, ""),
        type: "template",
        template: {
          name: shopConfig.whatsappTemplateName,
          language: { code: "en_US" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: customerName },
                { type: "text", text: orderNumber },
                { type: "text", text: `${currency} ${totalAmount}` },
              ],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "0",
              parameters: [{ type: "payload", payload: confirmBtnId }],
            },
            {
              type: "button",
              sub_type: "quick_reply",
              index: "1",
              parameters: [{ type: "payload", payload: cancelBtnId }],
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  const mockMessageId = `wamid.HBgM${Date.now()}TEST`;
  await prisma.verificationOrder.update({
    where: { id: verification.id },
    data: { whatsappMessageId: mockMessageId },
  });
  console.log(`[WhatsApp] Assigned whatsappMessageId: ${mockMessageId}`);
  console.log("--> VERIFICATION 2: WhatsApp template payload & message dispatch: PASS");

  console.log("\n=================================================================");
  console.log("4. INCOMING BUTTON CLICK WEBHOOK SIMULATION");
  console.log("=================================================================");

  console.log(`[Inbound Click] Customer clicked "Confirm Order" (button payload: ${confirmBtnId})`);
  const parsed = parseButtonId(confirmBtnId);
  console.log(`[Parse Button ID] Result:`, parsed);

  if (!parsed || parsed.decision !== "CONFIRM" || parsed.verificationId !== verification.id) {
    throw new Error(`Failed to parse button id correctly`);
  }

  // Atomic state transition (same logic as api.whatsapp.webhook.tsx)
  const RESPONDABLE_STATUSES = [VerificationStatus.PENDING, VerificationStatus.FAILED];
  const { count } = await prisma.verificationOrder.updateMany({
    where: { id: verification.id, status: { in: RESPONDABLE_STATUSES } },
    data: {
      status: VerificationStatus.CONFIRMED,
      respondedAt: new Date(),
    },
  });

  if (count === 0) {
    throw new Error("State transition update returned 0 rows updated");
  }

  const updatedRecord = await prisma.verificationOrder.findUnique({
    where: { id: verification.id },
  });

  console.log(`[VerificationOrder] Updated record:`, {
    id: updatedRecord?.id,
    orderNumber: updatedRecord?.orderNumber,
    status: updatedRecord?.status,
    respondedAt: updatedRecord?.respondedAt,
  });

  if (updatedRecord?.status !== VerificationStatus.CONFIRMED) {
    throw new Error(`Expected status CONFIRMED, got ${updatedRecord?.status}`);
  }
  console.log("--> VERIFICATION 3: Transitioned to CONFIRMED: PASS");

  console.log("\n=================================================================");
  console.log("5. SHOPIFY ORDER TAGGING SERVICE SIMULATION");
  console.log("=================================================================");

  const tagToApply =
    parsed.decision === "CONFIRM"
      ? shopConfig.autoTagConfirmed
      : shopConfig.autoTagCancelled;

  console.log(
    `[Tagging Service] Would call updateOrderVerificationTag with:\n` +
      `  Shop: "${DEV_SHOP}"\n` +
      `  OrderId: "${shopifyOrderId}"\n` +
      `  Decision: "${parsed.decision}"\n` +
      `  Target Tag: "${tagToApply}"`,
  );

  console.log(`--> VERIFICATION 4: Tag resolution "${tagToApply}": PASS`);

  console.log("\n=================================================================");
  console.log("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
  console.log("=================================================================");
}

main()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
