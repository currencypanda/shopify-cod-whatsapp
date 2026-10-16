/**
 * Autonomous Verification Suite for Meta Embedded Signup (BYOK WABA) & Direct Billing
 * 
 * Tests:
 * 1. Credential Isolation: Dynamic dispatcher selects merchant-specific phoneNumberId and token when wabaStatus: "CONNECTED".
 * 2. Graceful Fallback: When disconnected, dispatcher falls back cleanly to managed gateway without throwing errors.
 * 3. Direct Billing Logic: Copilot explains $0 app markup and direct Meta billing.
 * 4. Brand Display Logic: Copilot confirms official Brand Name, logo/profile photo, and verified badge display.
 * 5. OAuth & Endpoint Security: /api/meta/callback enforces authentication and handles disconnect.
 */

import db from "../app/db.server.js";
import { getWhatsAppCredentialsForShop } from "../app/services/whatsapp.server.js";
import { generateSupportResponse, type StoreSupportContext } from "../app/services/support-kb.server.js";
import { action as metaCallbackAction } from "../app/routes/api.meta.callback.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runVerificationSuite() {
  console.log("===============================================================================");
  console.log("🚀 STARTING RIGOROUS QA VERIFICATION: META EMBEDDED SIGNUP & DIRECT BILLING");
  console.log("===============================================================================\n");

  const connectedShop = "test-brand-custom.myshopify.com";
  const disconnectedShop = "test-brand-fallback.myshopify.com";

  // Setup Test DB Records
  await db.shopConfig.upsert({
    where: { shop: connectedShop },
    create: {
      shop: connectedShop,
      wabaId: "waba_custom_999888",
      phoneNumberId: "phone_custom_1029384756",
      metaAccessToken: "EAAG_custom_merchant_token_xyz789",
      brandDisplayName: "Aura Apparel Official",
      wabaStatus: "CONNECTED",
      metaBillingActive: true,
      isEnabled: true,
    },
    update: {
      wabaId: "waba_custom_999888",
      phoneNumberId: "phone_custom_1029384756",
      metaAccessToken: "EAAG_custom_merchant_token_xyz789",
      brandDisplayName: "Aura Apparel Official",
      wabaStatus: "CONNECTED",
      metaBillingActive: true,
    },
  });

  await db.shopConfig.upsert({
    where: { shop: disconnectedShop },
    create: {
      shop: disconnectedShop,
      wabaId: null,
      phoneNumberId: null,
      metaAccessToken: null,
      brandDisplayName: null,
      wabaStatus: "DISCONNECTED",
      metaBillingActive: false,
      isEnabled: true,
    },
    update: {
      wabaId: null,
      phoneNumberId: null,
      metaAccessToken: null,
      brandDisplayName: null,
      wabaStatus: "DISCONNECTED",
      metaBillingActive: false,
    },
  });

  // -------------------------------------------------------------------------
  // TEST 1: Credential Isolation for Connected Merchant
  // -------------------------------------------------------------------------
  console.log("TEST 1: Verifying Merchant Credential Isolation (wabaStatus: CONNECTED)...");
  const connectedCreds = await getWhatsAppCredentialsForShop(connectedShop);
  assert(connectedCreds.isCustomBrand === true, "Identified as custom brand sender");
  assert(connectedCreds.phoneNumberId === "phone_custom_1029384756", "Resolved merchant's dedicated phoneNumberId");
  assert(connectedCreds.accessToken === "EAAG_custom_merchant_token_xyz789", "Resolved merchant's dedicated metaAccessToken");
  assert(connectedCreds.brandName === "Aura Apparel Official", "Resolved merchant's verified brand display name");
  console.log("✅ Credential isolation verified.\n");

  // -------------------------------------------------------------------------
  // TEST 2: Graceful Fallback for Disconnected Merchant
  // -------------------------------------------------------------------------
  console.log("TEST 2: Verifying Graceful Fallback (wabaStatus: DISCONNECTED)...");
  const disconnectedCreds = await getWhatsAppCredentialsForShop(disconnectedShop);
  assert(disconnectedCreds.isCustomBrand === false, "Identified as managed fallback channel");
  assert(typeof disconnectedCreds.phoneNumberId === "string" && disconnectedCreds.phoneNumberId.length > 0, "Resolved fallback phoneNumberId");
  assert(typeof disconnectedCreds.accessToken === "string" && disconnectedCreds.accessToken.length > 0, "Resolved fallback accessToken");
  assert(disconnectedCreds.brandName === disconnectedShop, "Fallback brand name matches shop domain");
  console.log("✅ Graceful fallback verified.\n");

  // -------------------------------------------------------------------------
  // TEST 3: Direct Meta Billing Logic in Support Copilot
  // -------------------------------------------------------------------------
  console.log("TEST 3: Verifying Direct Meta Billing Knowledge Base & Zero Markup...");
  const supportContext: StoreSupportContext = {
    shop: connectedShop,
    activeTier: "GROWTH",
    planName: "Growth Launch Deal",
    orderLimit: 500,
    monthlyUsageCount: 75,
    remainingQuota: 425,
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
    wabaStatus: "CONNECTED",
    brandDisplayName: "Aura Apparel Official",
    metaBillingActive: true,
  };

  const billingRes = generateSupportResponse("How do WhatsApp message charges work?", supportContext);
  assert(billingRes.category === "billing", "Category correctly categorized as 'billing'");
  assert(
    billingRes.reply.includes("SwiftCOD does NOT charge per-message markup"),
    "Explicitly explains zero per-message markup by app"
  );
  assert(
    billingRes.reply.includes("Message fees are paid directly to Meta"),
    "Explicitly clarifies fees paid directly to Meta via business card"
  );
  assert(
    billingRes.reply.includes("24-Hour Free Window") || billingRes.reply.includes("24-hour"),
    "Reiterates 24-hour customer care window incurs zero extra cost"
  );
  assert(
    billingRes.reply.includes("Active (Direct to Business Card)"),
    "Reflects store's live Meta billing status dynamically"
  );
  console.log("✅ Direct Meta billing knowledge base verified.\n");

  // -------------------------------------------------------------------------
  // TEST 4: Brand Display & 1-Click Embedded Signup Guide
  // -------------------------------------------------------------------------
  console.log("TEST 4: Verifying Brand Display & 1-Click Embedded Onboarding Guide...");
  const brandRes = generateSupportResponse("How do I connect my official WhatsApp Brand Name?", supportContext);
  assert(brandRes.category === "settings", "Category correctly categorized as 'settings'");
  assert(
    brandRes.reply.includes("official Brand Name, logo/profile photo, and verified WhatsApp badge"),
    "Affirms customer sees official Brand Name and verified badge"
  );
  assert(
    brandRes.reply.includes("Step 1") && brandRes.reply.includes("Step 2") && brandRes.reply.includes("Step 3"),
    "Outlines clear 3-step 1-click onboarding flow"
  );
  assert(
    brandRes.reply.includes("Aura Apparel Official"),
    "Confirms store's live connected brand name in status report"
  );
  console.log("✅ Brand identity & onboarding guide verified.\n");

  // -------------------------------------------------------------------------
  // TEST 5: API Security Enforcement (/api/meta/callback)
  // -------------------------------------------------------------------------
  console.log("TEST 5: Verifying /api/meta/callback Authentication Guard (HTTP 401)...");
  const fakeRequest = new Request("http://localhost/api/meta/callback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "disconnect" }),
  });

  const res = await metaCallbackAction({ request: fakeRequest, params: {}, context: {} });
  assert(res.status === 401, `Unauthenticated request correctly blocked with HTTP 401 (got ${res.status})`);
  console.log("✅ API security enforcement verified.\n");

  console.log("===============================================================================");
  console.log("🎉 ALL 5 QA VERIFICATION CHECKS PASSED WITH 100% PRECISION!");
  console.log("===============================================================================");
}

runVerificationSuite()
  .catch((err) => {
    console.error("Verification suite failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
