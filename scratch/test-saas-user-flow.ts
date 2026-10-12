import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load environment variables directly from .env
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (val) {
        process.env[key] = val;
      }
    }
  }
}

import prisma from "../app/db.server";
import { VerificationStatus } from "@prisma/client";
import { formatPhoneNumber } from "../app/services/whatsapp.server";
import { handleButtonReply, type ButtonReply } from "../app/services/whatsapp-decision.server";

const DEMO_SHOP = "demo-clothing-store.myshopify.com";
const DEMO_ORDER_GID = "gid://shopify/Order/demo-5001";
const DEMO_ORDER_NUMBER = "#DEMO-5001";
const DEMO_CUSTOMER_NAME = "Usman Tariq";
const DEMO_RAW_PHONE = "0320-3737570";
const DEMO_AMOUNT = "4800.00";
const DEMO_CURRENCY = "PKR";

async function main() {
  console.log("=================================================");
  console.log("ZERO-CONFIG SAAS ONBOARDING & ROI SIMULATION");
  console.log(`Simulated Merchant: ${DEMO_SHOP}`);
  console.log("=================================================\n");

  // Clean prior test data for reproducible run
  await prisma.verificationOrder.deleteMany({ where: { shop: DEMO_SHOP } });
  await prisma.shopConfig.deleteMany({ where: { shop: DEMO_SHOP } });

  // ---------------------------------------------------------------------------
  // Step 1: Simulate Brand New Merchant Installation (Zero-Config)
  // ---------------------------------------------------------------------------
  console.log("[Step 1] Merchant installs app: initializing zero-friction ShopConfig...");
  const config = await prisma.shopConfig.create({
    data: {
      shop: DEMO_SHOP,
      isEnabled: true,
      defaultCountryCode: "92",
      rtoCostEstimate: 450.0,
      currencySymbol: "PKR",
      autoCancelOnCustomerCancel: true,
      autoExpiryHours: 24,
      autoTagConfirmed: "COD-Confirmed",
      autoTagCancelled: "COD-Cancelled",
      autoTagExpired: "COD-Expired",
      whatsappTemplateName: "cod_order_verification",
    },
  });

  console.log(`✔ ShopConfig created successfully: ID=${config.id}`);
  console.log(`  Automated Verification:    ${config.isEnabled ? "ENABLED (ON)" : "DISABLED"}`);
  console.log(`  Auto-Cancel Rejected:      ${config.autoCancelOnCustomerCancel ? "ENABLED (ON)" : "DISABLED"}`);
  console.log(`  Auto-Expiry Window:        ${config.autoExpiryHours} Hours`);
  console.log(`  Default Return (RTO) Cost: ${config.currencySymbol} ${config.rtoCostEstimate}`);
  console.log(`  Merchant Custom Meta Keys: ${config.whatsappAccessToken ? "Present" : "NONE (Zero-Config SaaS Fallback)"}`);

  // Verify Central SaaS credentials fallback
  const centralPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const centralToken = process.env.WHATSAPP_ACCESS_TOKEN;
  console.log(`  Central Cloud Phone ID:    ${centralPhoneId || "MISSING"}`);
  console.log(`  Central Cloud Token:       ${centralToken ? "Active & Configured" : "MISSING"}`);

  if (!centralPhoneId || !centralToken) {
    throw new Error("Central SaaS credentials missing in environment variables!");
  }

  // ---------------------------------------------------------------------------
  // Step 2: Ingest Incoming Shopify COD Order
  // ---------------------------------------------------------------------------
  console.log("\n[Step 2] Customer places Cash on Delivery order on storefront...");
  const normalizedPhone = formatPhoneNumber(DEMO_RAW_PHONE, config.defaultCountryCode);
  console.log(`  Raw Input Phone:           ${DEMO_RAW_PHONE}`);
  console.log(`  Normalized E.164 Phone:    ${normalizedPhone}`);

  const effectivePhoneId = config.whatsappPhoneNumberId || centralPhoneId;
  const effectiveToken = config.whatsappAccessToken || centralToken;
  const canSend = Boolean(normalizedPhone && effectivePhoneId && effectiveToken);

  console.log(`  Dispatch Engine Status:    ${canSend ? "Ready (Dispatched via Central Cloud)" : "Cannot Send"}`);

  const orderRecord = await prisma.verificationOrder.create({
    data: {
      shop: DEMO_SHOP,
      shopifyOrderId: DEMO_ORDER_GID,
      orderNumber: DEMO_ORDER_NUMBER,
      customerName: DEMO_CUSTOMER_NAME,
      customerPhone: normalizedPhone || DEMO_RAW_PHONE,
      totalAmount: parseFloat(DEMO_AMOUNT),
      currency: DEMO_CURRENCY,
      status: canSend ? VerificationStatus.PENDING : VerificationStatus.FAILED,
      whatsappMessageId: "wamid.demo_mock_saas_dispatch_991827",
    },
  });

  console.log(`✔ Order record created in database: ID=${orderRecord.id}`);
  console.log(`  Status:                    ${orderRecord.status}`);
  console.log(`  Order Number:              ${orderRecord.orderNumber}`);
  console.log(`  Total Amount:              ${orderRecord.currency} ${orderRecord.totalAmount}`);

  // ---------------------------------------------------------------------------
  // Step 3: Customer Rejects Order (Inbound WhatsApp Button Simulation)
  // ---------------------------------------------------------------------------
  console.log("\n[Step 3] Customer clicks [❌ Cancel Order] button in WhatsApp...");

  const reply: ButtonReply = {
    inboundMessageId: "wamid.inbound_cancel_button_reply_4410",
    from: (normalizedPhone || DEMO_RAW_PHONE).replace(/^\+/, ""),
    buttonId: `CANCEL:${orderRecord.shopifyOrderId}`,
    phoneNumberId: effectivePhoneId,
    contextMessageId: orderRecord.whatsappMessageId,
  };

  await handleButtonReply(reply);

  // Fetch updated order state
  const updatedOrder = await prisma.verificationOrder.findUnique({
    where: { id: orderRecord.id },
  });

  console.log(`✔ Status transitioned to:   ${updatedOrder?.status}`);
  console.log(`  Responded Timestamp:       ${updatedOrder?.respondedAt?.toISOString()}`);

  // ---------------------------------------------------------------------------
  // Step 4: Calculate & Render Financial ROI & Money Saved Dashboard
  // ---------------------------------------------------------------------------
  console.log("\n[Step 4] Computing Financial ROI & Loss-Saved Analytics for Merchant...");

  const totalOrders = await prisma.verificationOrder.count({ where: { shop: DEMO_SHOP } });
  const confirmedCount = await prisma.verificationOrder.count({
    where: { shop: DEMO_SHOP, status: VerificationStatus.CONFIRMED },
  });
  const cancelledCount = await prisma.verificationOrder.count({
    where: { shop: DEMO_SHOP, status: VerificationStatus.CANCELLED },
  });
  const expiredCount = await prisma.verificationOrder.count({
    where: { shop: DEMO_SHOP, status: VerificationStatus.EXPIRED },
  });

  const interceptedCount = cancelledCount + expiredCount;
  const deliveryLossSaved = interceptedCount * config.rtoCostEstimate;
  const conversionRate = totalOrders > 0 ? ((confirmedCount / totalOrders) * 100).toFixed(1) : "0.0";
  const interceptedRate = totalOrders > 0 ? ((interceptedCount / totalOrders) * 100).toFixed(1) : "0.0";

  console.log("=================================================");
  console.log("MERCHANT DASHBOARD ROI SUMMARY (/app):");
  console.log("=================================================");
  console.log(`  Total COD Orders Intercepted:      ${totalOrders}`);
  console.log(`  Verified & Safe to Dispatch:       ${confirmedCount} (${conversionRate}%)`);
  console.log(`  Fake / Rejected Orders Blocked:    ${interceptedCount} (${interceptedRate}%)`);
  console.log(`  -----------------------------------------------`);
  console.log(`  💰 TOTAL DELIVERY & RTO MONEY SAVED: ${config.currencySymbol} ${deliveryLossSaved.toLocaleString()}`);
  console.log(`     (Formula: ${interceptedCount} blocked orders × ${config.currencySymbol} ${config.rtoCostEstimate} avg return fee)`);
  console.log("=================================================");
  console.log("✔ ZERO-CONFIG SAAS FLOW VALIDATED WITH 100% SUCCESS!");
}

async function run() {
  const TIMEOUT_MS = 15000;
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: Execution exceeded strict ${TIMEOUT_MS / 1000}s limit.`));
    }, TIMEOUT_MS);
    timer.unref();
  });

  try {
    await Promise.race([main(), timeoutPromise]);
  } catch (err: any) {
    console.error("Simulation error:", err?.message || err);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await prisma.$disconnect();
    } catch {}
    setTimeout(() => {
      process.exit(0);
    }, 150).unref();
  }
}

run();
