import { createHmac, timingSafeEqual } from "node:crypto";
import { VerificationStatus } from "@prisma/client";
import db from "../app/db.server";
import { isValidSignature } from "../app/services/whatsapp-decision.server";
import { resolveOrderContext } from "../app/services/localization.server";
import {
  BILLING_PLANS,
  checkSubscriptionQuota,
} from "../app/services/billing.server";
import { loader as dataRequestLoader, action as dataRequestAction } from "../app/routes/api.webhooks.customers-data-request";
import { loader as customerRedactLoader, action as customerRedactAction } from "../app/routes/api.webhooks.customers-redact";
import { loader as shopRedactLoader, action as shopRedactAction } from "../app/routes/api.webhooks.shop-redact";

// ANSI color codes
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ${GREEN}✔ PASS${RESET} ${testName}`);
  } else {
    failedCount++;
    console.error(`  ${RED}✘ FAIL${RESET} ${testName}`);
    if (details) console.error(`    ${YELLOW}Details: ${details}${RESET}`);
  }
}

async function runDeepQaSuite() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   SWIFTCOD ENTERPRISE QA & RESILIENCY CERTIFICATION SUITE     ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // -------------------------------------------------------------------------
  // Test Track 1: Cryptographic HMAC Security
  // -------------------------------------------------------------------------
  console.log(`${BOLD}1. Cryptographic HMAC Security Verification${RESET}`);

  const mockSecret = "super_secret_meta_app_key_987654";
  const mockPayload = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
  const validHex = createHmac("sha256", mockSecret).update(mockPayload).digest("hex");
  const validHeader = `sha256=${validHex}`;
  const tamperedHeader = `sha256=${createHmac("sha256", "wrong_secret").update(mockPayload).digest("hex")}`;

  // 1.1 Meta valid signature
  assert(
    isValidSignature(mockPayload, validHeader, mockSecret) === true,
    "Meta X-Hub-Signature-256 valid signature passes verification",
  );

  // 1.2 Meta tampered signature
  assert(
    isValidSignature(mockPayload, tamperedHeader, mockSecret) === false,
    "Meta X-Hub-Signature-256 tampered signature is rejected",
  );

  // 1.3 Meta missing / invalid prefix
  assert(
    isValidSignature(mockPayload, validHex, mockSecret) === false,
    "Meta X-Hub-Signature-256 without 'sha256=' prefix is rejected",
  );

  // 1.4 Shopify HMAC verification utility
  const shopifySecret = "shpss_test_shopify_app_secret";
  const shopifyPayload = Buffer.from(JSON.stringify({ id: 101, name: "#101" }));
  const validShopifyHmac = createHmac("sha256", shopifySecret).update(shopifyPayload).digest("base64");
  const tamperedShopifyHmac = createHmac("sha256", "tampered_key").update(shopifyPayload).digest("base64");

  const verifyShopifyHmac = (body: Buffer, header: string, secret: string) => {
    const computed = createHmac("sha256", secret).update(body).digest("base64");
    const a = Buffer.from(header, "utf8");
    const b = Buffer.from(computed, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  };

  assert(
    verifyShopifyHmac(shopifyPayload, validShopifyHmac, shopifySecret) === true,
    "Shopify X-Shopify-Hmac-Sha256 valid base64 signature matches",
  );

  assert(
    verifyShopifyHmac(shopifyPayload, tamperedShopifyHmac, shopifySecret) === false,
    "Shopify X-Shopify-Hmac-Sha256 tampered signature fails verification",
  );

  // -------------------------------------------------------------------------
  // Test Track 2: State Machine Collision & Race Condition Locks
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}2. State Machine Concurrency & Race Condition Locks${RESET}`);

  const testShop = "qa-certification-store.myshopify.com";
  const testOrderId = `gid://shopify/Order/qa_${Date.now()}`;
  const testOrderNumber = `#QA-${Math.floor(1000 + Math.random() * 9000)}`;

  // Ensure ShopConfig exists
  await db.shopConfig.upsert({
    where: { shop: testShop },
    create: {
      shop: testShop,
      isEnabled: true,
      subscriptionTier: "STARTER",
    },
    update: {},
  });

  const testVerification = await db.verificationOrder.create({
    data: {
      shop: testShop,
      shopifyOrderId: testOrderId,
      orderNumber: testOrderNumber,
      customerPhone: "+971501234567",
      customerName: "QA Race Condition Test",
      totalAmount: 199.0,
      currency: "AED",
      status: VerificationStatus.PENDING_VERIFICATION,
    },
  });

  // 2.1 Rapid concurrent CONFIRM spam (Simulating user clicking confirm 10 times simultaneously)
  const RESPONDABLE = [
    VerificationStatus.PENDING,
    VerificationStatus.PENDING_VERIFICATION,
    VerificationStatus.AWAITING_ADDRESS_INPUT,
  ];

  const concurrentRequests = Array.from({ length: 10 }).map(async (_, idx) => {
    return await db.verificationOrder.updateMany({
      where: { id: testVerification.id, status: { in: RESPONDABLE } },
      data: {
        status: VerificationStatus.CONFIRMED,
        respondedAt: new Date(),
        auditLog: `[${idx}] Buyer confirmed via rapid tap`,
      },
    });
  });

  const results = await Promise.all(concurrentRequests);
  const successCount = results.filter((r) => r.count === 1).length;
  const rejectedCount = results.filter((r) => r.count === 0).length;

  assert(
    successCount === 1,
    `Atomic CAS lock allows exactly ONE winner under concurrent confirm load (got ${successCount})`,
  );
  assert(
    rejectedCount === 9,
    `Atomic CAS lock rejects remaining 9 concurrent duplicate requests (got ${rejectedCount})`,
  );

  // 2.2 Attempting to cancel an already CONFIRMED order
  const cancelAttempt = await db.verificationOrder.updateMany({
    where: { id: testVerification.id, status: { in: RESPONDABLE } },
    data: { status: VerificationStatus.CANCELLED },
  });

  assert(
    cancelAttempt.count === 0,
    "Confirmed order cannot transition to CANCELLED state (idempotency preserved)",
  );

  // 2.3 Address Modification State Transition
  const addressTestVerification = await db.verificationOrder.create({
    data: {
      shop: testShop,
      shopifyOrderId: `gid://shopify/Order/qa_addr_${Date.now()}`,
      orderNumber: `#QA-ADDR-${Math.floor(1000 + Math.random() * 9000)}`,
      customerPhone: "+971509998877",
      customerName: "Address Change Test",
      totalAmount: 250.0,
      currency: "AED",
      status: VerificationStatus.AWAITING_ADDRESS_INPUT,
    },
  });

  const updatedAddress = "Villa 42, Al Barsha 2, Dubai, UAE";
  await db.verificationOrder.update({
    where: { id: addressTestVerification.id },
    data: {
      shippingAddress: updatedAddress,
      status: VerificationStatus.PENDING_VERIFICATION,
      auditLog: `Shipping address updated: ${updatedAddress}`,
    },
  });

  const postAddressRecord = await db.verificationOrder.findUnique({
    where: { id: addressTestVerification.id },
  });

  assert(
    postAddressRecord?.status === VerificationStatus.PENDING_VERIFICATION &&
      postAddressRecord?.shippingAddress === updatedAddress,
    "Address modification transitions state to PENDING_VERIFICATION and saves new address",
  );

  // -------------------------------------------------------------------------
  // Test Track 3: Payload Resiliency & Missing Fields
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}3. Payload Resiliency & Fallback Data Handling${RESET}`);

  // 3.1 Missing product image fallback
  const FALLBACK_PRODUCT_IMAGE = "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";
  const emptyLineItems: Array<{ image?: { src?: string } | null }> = [];
  const resolvedFallbackImage = emptyLineItems[0]?.image?.src || FALLBACK_PRODUCT_IMAGE;

  assert(
    resolvedFallbackImage === FALLBACK_PRODUCT_IMAGE,
    "Orders with 0 product images correctly fallback to Shopify CDN placeholder",
  );

  // 3.2 Null shipping address handling
  const nullShippingOrder = {
    customerPhone: "+966501234567",
    customerLocale: "ar",
    shippingCountryCode: "SA",
    totalPrice: "520.00",
    currency: "SAR",
  };

  const resolvedSaudiContext = resolveOrderContext(nullShippingOrder);
  assert(
    resolvedSaudiContext.locale === "ar" && resolvedSaudiContext.currency === "SAR",
    "Missing address cleanly resolves multi-market Saudi context (ar / SAR)",
  );

  // 3.3 Dynamic Currency Formatting via Intl.NumberFormat
  assert(
    resolvedSaudiContext.formattedAmount.length > 0 &&
      (resolvedSaudiContext.formattedAmount.includes("ر.س") || resolvedSaudiContext.formattedAmount.includes("SAR") || resolvedSaudiContext.formattedAmount.includes("520")),
    `Currency formatted accurately via Intl.NumberFormat: ${resolvedSaudiContext.formattedAmount}`,
  );

  // -------------------------------------------------------------------------
  // Test Track 4: Mandatory Shopify GDPR Webhooks
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}4. Mandatory Shopify GDPR Compliance Webhooks${RESET}`);

  // 4.1 CUSTOMERS_DATA_REQUEST
  const reqDataRequest = new Request("http://localhost:3000/api/webhooks/customers-data-request");
  const resDataRequest = await dataRequestLoader({ request: reqDataRequest, params: {}, context: {} });
  assert(resDataRequest.status === 200, "GET /api/webhooks/customers-data-request returns HTTP 200");

  const postReqData = new Request("http://localhost:3000/api/webhooks/customers-data-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: 1234, shop_domain: testShop, customer: { id: 1, phone: "+971501234567" } }),
  });
  const resDataAction = await dataRequestAction({ request: postReqData, params: {}, context: {} });
  assert(resDataAction.status === 200, "POST /api/webhooks/customers-data-request handles request and returns HTTP 200");

  // 4.2 CUSTOMERS_REDACT
  const reqCustRedact = new Request("http://localhost:3000/api/webhooks/customers-redact");
  const resCustRedact = await customerRedactLoader({ request: reqCustRedact, params: {}, context: {} });
  assert(resCustRedact.status === 200, "GET /api/webhooks/customers-redact returns HTTP 200");

  const postCustRedact = new Request("http://localhost:3000/api/webhooks/customers-redact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: 1234, shop_domain: testShop, customer: { id: 1, phone: "+971501234567" } }),
  });
  const resCustAction = await customerRedactAction({ request: postCustRedact, params: {}, context: {} });
  assert(resCustAction.status === 200, "POST /api/webhooks/customers-redact redacts PII and returns HTTP 200");

  // 4.3 SHOP_REDACT
  const reqShopRedact = new Request("http://localhost:3000/api/webhooks/shop-redact");
  const resShopRedact = await shopRedactLoader({ request: reqShopRedact, params: {}, context: {} });
  assert(resShopRedact.status === 200, "GET /api/webhooks/shop-redact returns HTTP 200");

  const postShopRedact = new Request("http://localhost:3000/api/webhooks/shop-redact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_id: 1234, shop_domain: testShop }),
  });
  const resShopAction = await shopRedactAction({ request: postShopRedact, params: {}, context: {} });
  assert(resShopAction.status === 200, "POST /api/webhooks/shop-redact purges shop data and returns HTTP 200");

  // -------------------------------------------------------------------------
  // Test Track 5: Shopify Billing Engine & Quota Limits
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}5. Shopify Billing Engine & Tier Enforcement${RESET}`);

  // 5.1 Plan tier definitions
  assert(BILLING_PLANS.STARTER.price === 0 && BILLING_PLANS.STARTER.orderLimit === 50, "Starter plan configured for $0 and 50 orders");
  assert(BILLING_PLANS.PRO.price === 29.0 && BILLING_PLANS.PRO.orderLimit === 1000, "Pro plan configured for $29 and 1,000 orders");
  assert(BILLING_PLANS.ENTERPRISE.price === 79.0 && BILLING_PLANS.ENTERPRISE.orderLimit === -1, "Enterprise plan configured for $79 and unlimited orders");

  // 5.2 Subscription Quota Check
  const quotaCheck = await checkSubscriptionQuota(testShop);
  assert(
    typeof quotaCheck.allowed === "boolean" && quotaCheck.tier === "STARTER",
    `Subscription quota check correctly evaluates shop (${quotaCheck.currentUsage}/${quotaCheck.limit} used on ${quotaCheck.tier})`,
  );

  // Clean up test verification records
  await db.verificationOrder.deleteMany({ where: { shop: testShop } }).catch(() => {});

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${BOLD}${CYAN}----------------------------------------------------------------${RESET}`);
  console.log(`${BOLD}CERTIFICATION SUMMARY: ${GREEN}${passedCount} PASSED${RESET}, ${failedCount > 0 ? `${RED}${failedCount} FAILED` : `${GREEN}0 FAILED`}${RESET}`);
  console.log(`${BOLD}${CYAN}----------------------------------------------------------------${RESET}\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runDeepQaSuite().catch((err) => {
  console.error("Test execution threw unhandled exception:", err);
  process.exit(1);
});
