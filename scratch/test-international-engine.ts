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
import { unauthenticated } from "../app/shopify.server";
import { VerificationStatus } from "@prisma/client";
import {
  resolveLocale,
  formatCurrency,
  normalizePhoneNumber,
  resolveOrderContext,
  buildLocalizedOrderMessage,
  I18N_DICTIONARIES,
} from "../app/services/localization.server";
import {
  parseInteractiveAction,
  parseButtonId,
  buildActionId,
} from "../app/services/whatsapp.server";
import {
  handleUnifiedInboundMessage,
  type UnifiedInboundMessage,
} from "../app/services/whatsapp-decision.server";
import {
  updateOrderShippingAddress,
  updateOrderDeliverySlot,
  applyOrderEditQuantity,
  cancelShopifyOrder,
} from "../app/services/shopify-orders.server";

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";

interface TestResult {
  scenario: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, scenario: string, name: string, details: string) {
  if (condition) {
    results.push({ scenario, name, passed: true, details });
    console.log(`  [PASS] ${name}: ${details}`);
  } else {
    results.push({ scenario, name, passed: false, details });
    console.error(`  [FAIL] ${name}: ${details}`);
  }
}

async function runInternationalEngineTests() {
  console.log("===============================================================================");
  console.log("  ENTERPRISE MULTI-MARKET WHATSAPP COD VERIFICATION ENGINE TEST SUITE");
  console.log("===============================================================================\n");

  // Ensure ShopConfig exists in DB
  await prisma.shopConfig.upsert({
    where: { shop: TARGET_SHOP },
    update: {
      isEnabled: true,
      autoTagConfirmed: "COD-Confirmed",
      autoTagCancelled: "COD-Cancelled",
      autoCancelOnCustomerCancel: true,
    },
    create: {
      shop: TARGET_SHOP,
      isEnabled: true,
      autoTagConfirmed: "COD-Confirmed",
      autoTagCancelled: "COD-Cancelled",
      autoCancelOnCustomerCancel: true,
    },
  });

  const { admin, session } = await unauthenticated.admin(TARGET_SHOP);

  // ---------------------------------------------------------------------------
  // SCENARIO 1: Dynamic Geolocation, Currency & Multi-Language Engine
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 1: Dynamic Geolocation, Multi-Currency & Multi-Language ---");

  // 1.1 UAE Arabic Resolution
  const uaeArabicContext = resolveOrderContext({
    shippingCountryCode: "AE",
    customerLocale: "ar",
    totalPrice: "365.00",
    currency: "AED",
    customerPhone: "050 123 4567",
  });
  assert(
    uaeArabicContext.locale === "ar",
    "Scenario 1",
    "UAE Locale Resolution",
    `Resolved locale: ${uaeArabicContext.locale} (expected: ar)`,
  );
  assert(
    uaeArabicContext.currency === "AED",
    "Scenario 1",
    "UAE Currency Code",
    `Resolved currency: ${uaeArabicContext.currency} (expected: AED)`,
  );
  assert(
    uaeArabicContext.normalizedPhone === "+971501234567",
    "Scenario 1",
    "UAE Phone Normalization",
    `Normalized: ${uaeArabicContext.normalizedPhone} (expected: +971501234567)`,
  );

  const uaeFormattedPrice = formatCurrency(365, "AED", "ar");
  assert(
    uaeFormattedPrice.length > 0 && (uaeFormattedPrice.includes("365") || uaeFormattedPrice.includes("٣٦٥")),
    "Scenario 1",
    "Arabic Currency Formatting",
    `Formatted: "${uaeFormattedPrice}"`,
  );

  const arabicMsg = buildLocalizedOrderMessage({
    locale: "ar",
    storeName: "Luxury Oud Dubai",
    orderNumber: "#UAE-8801",
    customerName: "فاطمة أحمد",
    items: [{ title: "دهن عود كمبودي", quantity: 1, price: "365.00" }],
    shippingAddress: "دبي، البرشاء 2، شارع 18، فيلا 42",
    formattedAmount: uaeFormattedPrice,
  });
  assert(
    arabicMsg.includes("تأكيد طلب الدفع عند الاستلام") && arabicMsg.includes("Luxury Oud Dubai"),
    "Scenario 1",
    "Arabic Rich Message Template",
    "Includes localized Arabic header, customer greeting and store branding",
  );

  // 1.2 Spanish Order Resolution
  const esContext = resolveOrderContext({
    shippingCountryCode: "ES",
    customerLocale: "es-ES",
    totalPrice: 95.0,
    currency: "EUR",
    customerPhone: "612 345 678",
  });
  assert(
    esContext.locale === "es",
    "Scenario 1",
    "Spanish Locale Resolution",
    `Resolved locale: ${esContext.locale} (expected: es)`,
  );
  assert(
    esContext.normalizedPhone === "+34612345678",
    "Scenario 1",
    "Spanish Phone Normalization",
    `Normalized: ${esContext.normalizedPhone} (expected: +34612345678)`,
  );

  // 1.3 Global English Fallback
  const usContext = resolveOrderContext({
    shippingCountryCode: "US",
    totalPrice: 49.99,
    currency: "USD",
    customerPhone: "+1 (555) 234-5678",
  });
  assert(
    usContext.locale === "en" && usContext.currency === "USD",
    "Scenario 1",
    "Global English Fallback",
    `Locale: ${usContext.locale}, Currency: ${usContext.currency}`,
  );

  console.log("");

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Conversational Address Correction Flow (Text & GPS Pin)
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 2: Conversational Address Correction Flow ---");

  // Create test order in DB
  const testOrder2 = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: `gid://shopify/Order/9900002`,
      orderNumber: "#INTL-ADDR-1002",
      customerPhone: "+971501112233",
      customerName: "Rashid Al Mansoori",
      totalAmount: "450.00",
      currency: "AED",
      activeCurrency: "AED",
      activeLocale: "ar",
      shippingAddress: "Initial Address: Dubai Marina, Apt 104",
      status: VerificationStatus.PENDING_VERIFICATION,
    },
  });

  // Step 2.1: Buyer clicks Change Address
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.addr.1",
    from: "+971501112233",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "button_reply",
    actionId: buildActionId("EDIT_ADDRESS", testOrder2.id),
  });

  const order2AfterPrompt = await prisma.verificationOrder.findUnique({ where: { id: testOrder2.id } });
  assert(
    order2AfterPrompt?.status === VerificationStatus.AWAITING_ADDRESS_INPUT,
    "Scenario 2",
    "Transition to AWAITING_ADDRESS_INPUT",
    `Status transitioned to: ${order2AfterPrompt?.status}`,
  );

  // Step 2.2: Buyer sends text with updated address
  const newStreetAddress = "Villa 42, Street 18, Al Barsha 2, Dubai, UAE";
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.addr.2",
    from: "+971501112233",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "text",
    textBody: newStreetAddress,
  });

  const order2AfterText = await prisma.verificationOrder.findUnique({ where: { id: testOrder2.id } });
  assert(
    order2AfterText?.shippingAddress === newStreetAddress,
    "Scenario 2",
    "Address Text Update in Database",
    `Updated address saved: "${order2AfterText?.shippingAddress}"`,
  );
  assert(
    order2AfterText?.status === VerificationStatus.PENDING_VERIFICATION,
    "Scenario 2",
    "Reset to PENDING_VERIFICATION after Address",
    `Status recovered to: ${order2AfterText?.status}`,
  );
  assert(
    order2AfterText?.auditLog?.includes("Shipping address updated") ?? false,
    "Scenario 2",
    "Audit Log Address Entry",
    "Audit log contains chronological address modification entry",
  );

  // Step 2.3: Buyer shares GPS Location Pin
  const gpsLat = 25.1054;
  const gpsLng = 55.2012;
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.addr.3",
    from: "+971501112233",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "location",
    location: {
      latitude: gpsLat,
      longitude: gpsLng,
      name: "Home Pin",
      address: "Al Barsha, Dubai",
    },
  });

  const order2AfterGps = await prisma.verificationOrder.findUnique({ where: { id: testOrder2.id } });
  assert(
    order2AfterGps?.locationLat === gpsLat && order2AfterGps?.locationLng === gpsLng,
    "Scenario 2",
    "GPS Coordinates Saved",
    `Coordinates recorded: (${order2AfterGps?.locationLat}, ${order2AfterGps?.locationLng})`,
  );

  console.log("");

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Item Edit Flow (Quantity Modification)
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 3: Item Edit Flow (Quantity Modification) ---");

  const testOrder3 = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: `gid://shopify/Order/9900003`,
      orderNumber: "#INTL-ITEM-1003",
      customerPhone: "+971504445566",
      customerName: "Zaid Tariq",
      totalAmount: "199.00",
      currency: "AED",
      activeCurrency: "AED",
      activeLocale: "en",
      status: VerificationStatus.PENDING_VERIFICATION,
    },
  });

  // Step 3.1: Customer taps EDIT_ITEMS
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.item.1",
    from: "+971504445566",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "button_reply",
    actionId: buildActionId("EDIT_ITEMS", testOrder3.id),
  });

  const order3AfterPrompt = await prisma.verificationOrder.findUnique({ where: { id: testOrder3.id } });
  assert(
    order3AfterPrompt?.status === VerificationStatus.AWAITING_ITEM_MODIFICATION,
    "Scenario 3",
    "Transition to AWAITING_ITEM_MODIFICATION",
    `Status transitioned to: ${order3AfterPrompt?.status}`,
  );

  // Step 3.2: Customer sends modification request text
  const itemModText = "Please add +1 quantity for Snowboard (Total 2) and swap color to Midnight Blue";
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.item.2",
    from: "+971504445566",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "text",
    textBody: itemModText,
  });

  const order3AfterText = await prisma.verificationOrder.findUnique({ where: { id: testOrder3.id } });
  assert(
    order3AfterText?.status === VerificationStatus.PENDING_VERIFICATION,
    "Scenario 3",
    "Reset to PENDING_VERIFICATION after Item Change",
    `Status recovered to: ${order3AfterText?.status}`,
  );
  assert(
    order3AfterText?.auditLog?.includes("Item modification requested") ?? false,
    "Scenario 3",
    "Audit Log Item Modification Entry",
    "Audit log contains customer item adjustment details",
  );

  // Step 3.3: Verify Order Edit helper execution
  const editResult = await applyOrderEditQuantity(
    admin,
    "9900003",
    "gid://shopify/LineItem/140001",
    2,
    TARGET_SHOP,
    session?.accessToken,
  );
  assert(
    editResult.success === true,
    "Scenario 3",
    "applyOrderEditQuantity Execution",
    `Completed successfully (GraphQL or note fallback: ${editResult.editedViaGraphQL ? "GraphQL" : "Note/Attribute Record"})`,
  );

  console.log("");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: Delivery Time Slot Selection (Morning / Evening)
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 4: Delivery Time Slot Selection ---");

  const testOrder4 = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: `gid://shopify/Order/9900004`,
      orderNumber: "#INTL-SLOT-1004",
      customerPhone: "+971507778899",
      customerName: "Mariam Salem",
      totalAmount: "280.00",
      currency: "AED",
      activeCurrency: "AED",
      activeLocale: "ar",
      status: VerificationStatus.PENDING_VERIFICATION,
    },
  });

  // Step 4.1: Customer taps SELECT_TIME_SLOT
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.slot.1",
    from: "+971507778899",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "button_reply",
    actionId: buildActionId("SELECT_TIME_SLOT", testOrder4.id),
  });

  const order4AfterPrompt = await prisma.verificationOrder.findUnique({ where: { id: testOrder4.id } });
  assert(
    order4AfterPrompt?.status === VerificationStatus.AWAITING_SLOT_SELECTION,
    "Scenario 4",
    "Transition to AWAITING_SLOT_SELECTION",
    `Status transitioned to: ${order4AfterPrompt?.status}`,
  );

  // Step 4.2: Customer selects Evening slot
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.slot.2",
    from: "+971507778899",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "button_reply",
    actionId: buildActionId("SLOT_EVENING", testOrder4.id),
  });

  const order4AfterChoice = await prisma.verificationOrder.findUnique({ where: { id: testOrder4.id } });
  assert(
    (order4AfterChoice?.selectedTimeSlot?.includes("المساء") || order4AfterChoice?.selectedTimeSlot?.includes("Evening")) ?? false,
    "Scenario 4",
    "Localized Time Slot Stored",
    `Selected Slot: "${order4AfterChoice?.selectedTimeSlot}"`,
  );
  assert(
    order4AfterChoice?.status === VerificationStatus.PENDING_VERIFICATION,
    "Scenario 4",
    "Reset to PENDING_VERIFICATION after Slot Choice",
    `Status recovered to: ${order4AfterChoice?.status}`,
  );
  assert(
    order4AfterChoice?.auditLog?.includes("Delivery slot preference recorded") ?? false,
    "Scenario 4",
    "Audit Log Slot Entry",
    "Audit log contains time window preference",
  );

  console.log("");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Order Cancellation with Automated Restock
  // ---------------------------------------------------------------------------
  console.log("--- SCENARIO 5: Order Cancellation with Automated Restock ---");

  const testOrder5 = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: `gid://shopify/Order/9900005`,
      orderNumber: "#INTL-CANCEL-1005",
      customerPhone: "+971508889900",
      customerName: "Khaled Omar",
      totalAmount: "520.00",
      currency: "AED",
      activeCurrency: "AED",
      activeLocale: "en",
      status: VerificationStatus.PENDING_VERIFICATION,
    },
  });

  // Customer clicks CANCEL_ORDER
  await handleUnifiedInboundMessage({
    inboundMessageId: "wamid.msg.cancel.1",
    from: "+971508889900",
    phoneNumberId: "1421299311065349",
    contextMessageId: null,
    type: "button_reply",
    actionId: buildActionId("CANCEL", testOrder5.id),
  });

  const order5AfterCancel = await prisma.verificationOrder.findUnique({ where: { id: testOrder5.id } });
  assert(
    order5AfterCancel?.status === VerificationStatus.CANCELLED,
    "Scenario 5",
    "Order Cancellation Status in DB",
    `Status: ${order5AfterCancel?.status} (expected: CANCELLED)`,
  );
  assert(
    order5AfterCancel?.respondedAt !== null,
    "Scenario 5",
    "Cancellation Timestamp Recorded",
    `Responded at: ${order5AfterCancel?.respondedAt?.toISOString()}`,
  );
  assert(
    order5AfterCancel?.auditLog?.includes("restock: true") ?? false,
    "Scenario 5",
    "Auto-Restock Flag Logged",
    "Audit log confirms cancellation executed with inventory restock flag",
  );

  // Clean up test verification records
  await prisma.verificationOrder.deleteMany({
    where: {
      id: { in: [testOrder2.id, testOrder3.id, testOrder4.id, testOrder5.id] },
    },
  });

  console.log("\n===============================================================================");
  console.log("  VERIFICATION REPORT SUMMARY");
  console.log("===============================================================================");

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.table(
    results.map((r, i) => ({
      "#": i + 1,
      Scenario: r.scenario,
      Check: r.name,
      Status: r.passed ? "✔ PASS" : "❌ FAIL",
      Details: r.details,
    })),
  );

  console.log(`\nFinal Score: ${passedCount}/${totalCount} Checks Passed (${((passedCount / totalCount) * 100).toFixed(1)}%)\n`);

  if (passedCount === totalCount) {
    console.log("✔ ALL 5 ENTERPRISE MULTI-MARKET SCENARIOS PASSED WITH EXIT CODE 0!");
    process.exitCode = 0;
  } else {
    console.error("❌ SOME CHECKS FAILED!");
    process.exitCode = 1;
  }
}

runInternationalEngineTests()
  .catch((err) => {
    console.error("Fatal Test Suite Error:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    prisma.$disconnect();
  });
