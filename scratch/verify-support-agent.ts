/**
 * Autonomous Verification Suite for SwiftCOD 24/7 Support Copilot
 * 
 * Verifies:
 * 1. Security enforcement (HTTP 401 on unauthenticated requests to /api/support/chat).
 * 2. Scenario 1: Billing, pricing tiers & 7-day risk-free trial rollover mechanics.
 * 3. Scenario 2: Automatic inventory restock via Shopify GraphQL orderCancel(restock: true).
 * 4. Scenario 3: WhatsApp GPS location pin extraction & Shopify Order Timeline notes.
 * 5. Scenario 4: Live store quota & telemetry grounding (no hallucination).
 * 6. Scenario 5: WhatsApp delivery failure diagnostics & E.164 phone normalization.
 * 7. Scenario 6: Out-of-scope query graceful redirection.
 */

import { generateSupportResponse, type StoreSupportContext } from "../app/services/support-kb.server.js";
import { action, loader } from "../app/routes/api.support.chat.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log("===============================================================================");
  console.log("🚀 STARTING RIGOROUS QA VERIFICATION: SWIFTCOD 24/7 SUPPORT COPILOT");
  console.log("===============================================================================\n");

  // -------------------------------------------------------------------------
  // TEST 0: Security & Authentication Enforcement (HTTP 401)
  // -------------------------------------------------------------------------
  console.log("TEST 0: Verifying Unauthenticated Endpoint Protection (HTTP 401)...");
  
  // Verify loader is online
  const loaderReq = new Request("http://localhost/api/support/chat", { method: "GET" });
  const loaderRes = await loader({ request: loaderReq, params: {}, context: {} });
  const loaderData = await loaderRes.json();
  assert(loaderRes.status === 200, "Loader responds with HTTP 200");
  assert(loaderData.status === "online", "Loader reports service 'online'");

  // Verify POST without Shopify session throws or returns 401
  const fakePostReq = new Request("http://localhost/api/support/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Hello without session" }),
  });

  const actionRes = await action({ request: fakePostReq, params: {}, context: {} });
  assert(actionRes.status === 401, `Unauthenticated request blocked with HTTP 401 (got ${actionRes.status})`);
  const actionJson = await actionRes.json();
  assert(
    typeof actionJson.error === "string" && actionJson.error.includes("Unauthorized"),
    "401 response contains explicit unauthorized error message"
  );
  console.log("✅ Security & Authentication enforcement verified.\n");

  // -------------------------------------------------------------------------
  // Mock Store Context for Grounded Knowledge Base Queries
  // -------------------------------------------------------------------------
  const mockContext: StoreSupportContext = {
    shop: "enterprise-test-store.myshopify.com",
    activeTier: "GROWTH",
    planName: "Growth Launch Deal",
    orderLimit: 500,
    monthlyUsageCount: 42,
    remainingQuota: 458,
    botTone: "friendly",
    botLanguage: "auto",
    autoCancelOnCustomerCancel: true,
    autoExpiryHours: 24,
    tags: {
      confirmed: "COD-Confirmed",
      cancelled: "COD-Cancelled",
      addressModified: "COD-Address-Modified",
      hold: "COD-Hold",
      expired: "COD-Expired",
    },
    recentFailedOrder: {
      orderNumber: "#1099",
      customerPhone: "+923001234567",
      status: "FAILED",
      createdAt: new Date().toISOString(),
      failureReason: "Meta API code 131026: recipient not registered on WhatsApp",
    },
  };

  // -------------------------------------------------------------------------
  // TEST 1: Billing & 7-Day Trial Mechanics
  // -------------------------------------------------------------------------
  console.log("TEST 1: Verifying Billing & 7-Day Trial Rollover Mechanics...");
  const billingRes = generateSupportResponse("Explain the 7-day trial and billing rollover", mockContext);
  assert(billingRes.category === "billing", "Category correctly identified as 'billing'");
  assert(billingRes.reply.includes("$9.99"), "Contains Growth tier pricing ($9.99)");
  assert(billingRes.reply.includes("7-Day Risk-Free Trial") || billingRes.reply.includes("trialDays: 7"), "Explains 7-Day Free Trial");
  assert(billingRes.reply.includes("EVERY_30_DAYS"), "Explains 30-day recurring deduction interval");
  assert(billingRes.reply.includes("Free Starter"), "References Free Starter tier ($0.00)");
  assert(billingRes.reply.includes(mockContext.planName), "Reflects store's active tier dynamically");
  console.log("✅ Billing knowledge base verified.\n");

  // -------------------------------------------------------------------------
  // TEST 2: Inventory Restock & GraphQL Cancellation
  // -------------------------------------------------------------------------
  console.log("TEST 2: Verifying GraphQL Restock & Cancellation Workflow...");
  const restockRes = generateSupportResponse("How does automatic inventory restock work?", mockContext);
  assert(restockRes.category === "restock", "Category correctly identified as 'restock'");
  assert(restockRes.reply.includes("orderCancel(restock: true"), "Specifies Shopify GraphQL orderCancel(restock: true)");
  assert(restockRes.reply.includes("Voided"), "Mentions financial status update to Voided");
  assert(restockRes.reply.includes(mockContext.tags.cancelled), "Includes store's configured cancellation tag");
  assert(restockRes.reply.includes("Yes (Active)"), "Reflects merchant's active restock setting");
  console.log("✅ Restock & cancellation mechanics verified.\n");

  // -------------------------------------------------------------------------
  // TEST 3: GPS Pin Drop & Timeline Notes
  // -------------------------------------------------------------------------
  console.log("TEST 3: Verifying WhatsApp GPS Pin Drop Extraction...");
  const gpsRes = generateSupportResponse("How do customers drop their GPS location pin?", mockContext);
  assert(gpsRes.category === "location", "Category correctly identified as 'location'");
  assert(gpsRes.reply.includes("https://www.google.com/maps?q="), "Includes Google Maps URL navigation template");
  assert(gpsRes.reply.includes("Shopify Order Timeline / Notes"), "Explains timeline integration for couriers");
  assert(gpsRes.reply.includes(mockContext.tags.addressModified), "References COD-Address-Modified tag");
  console.log("✅ GPS location pin drop verified.\n");

  // -------------------------------------------------------------------------
  // TEST 4: Live Store Quota Grounding (Zero Hallucination)
  // -------------------------------------------------------------------------
  console.log("TEST 4: Verifying Live Store Quota Grounding...");
  const quotaRes = generateSupportResponse("Check my current plan & quota status", mockContext);
  assert(quotaRes.category === "quota", "Category correctly identified as 'quota'");
  assert(quotaRes.reply.includes(mockContext.shop), "Grounds response in exact shop domain");
  assert(quotaRes.reply.includes("42"), "Shows actual monthly usage count (42)");
  assert(quotaRes.reply.includes("458"), "Shows actual remaining balance (458)");
  assert(quotaRes.reply.includes("500"), "Shows total plan limit (500)");
  console.log("✅ Live telemetry quota grounding verified.\n");

  // -------------------------------------------------------------------------
  // TEST 5: Delivery Diagnostics & Phone Normalization
  // -------------------------------------------------------------------------
  console.log("TEST 5: Verifying Message Delivery Diagnostics & E.164 Format...");
  const diagRes = generateSupportResponse("Why did my customer's verification message fail?", mockContext);
  assert(diagRes.category === "troubleshooting", "Category correctly identified as 'troubleshooting'");
  assert(diagRes.reply.includes("E.164"), "Explains E.164 phone normalization");
  assert(diagRes.reply.includes("libphonenumber-js"), "Mentions phone validation engine");
  assert(diagRes.reply.includes("#1099"), "Diagnoses actual failed order number (#1099)");
  console.log("✅ Delivery diagnostics verified.\n");

  // -------------------------------------------------------------------------
  // TEST 6: Out of Scope & General Copilot Greeting
  // -------------------------------------------------------------------------
  console.log("TEST 6: Verifying Out-of-Scope Redirection & Core Scope Guidance...");
  const generalRes = generateSupportResponse("What is the capital of France?", mockContext);
  assert(generalRes.category === "general", "Category gracefully categorized as 'general'");
  assert(generalRes.reply.includes("SwiftCOD 24/7 AI Support Copilot"), "Introduces persona cleanly");
  assert(generalRes.reply.includes("Billing & Plans"), "Lists supported core capabilities");
  assert(Array.isArray(generalRes.suggestedFollowups) && generalRes.suggestedFollowups.length >= 3, "Provides helpful quick chips");
  console.log("✅ Out-of-scope redirection verified.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL 7 QA VERIFICATION CHECKS PASSED WITH 100% PRECISION!");
  console.log("===============================================================================");
}

runTestSuite().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
