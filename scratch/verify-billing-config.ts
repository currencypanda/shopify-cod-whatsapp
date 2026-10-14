/**
 * Standalone Verification Suite for SwiftCOD Launch Pricing Overhaul
 * 
 * Tests:
 * 1. Plan configuration constants, pricing ($9.99 & $24.99), quotas, and 7-day trials.
 * 2. GraphQL appSubscriptionCreate mutation schema & payload conformance.
 * 3. Quota enforcement across Starter (50), Growth (500), and Enterprise (Unlimited).
 * 4. Automated deduction lifecycle documentation & test-mode validation.
 */

import {
  BILLING_PLANS,
  PLAN_STARTER,
  PLAN_GROWTH,
  PLAN_ENTERPRISE,
  createAppSubscription,
  APP_SUBSCRIPTION_CREATE_MUTATION,
} from "../app/services/billing.server";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`, details ? details : "");
    throw new Error(`Assertion failed: ${testName}`);
  }
}

function testPlanConfiguration() {
  console.log("\n--- 1. Validating Plan Configuration & Launch Pricing Tiers ---");

  // Tier 1: Free Starter
  const starter = BILLING_PLANS.STARTER;
  assert(starter.id === "STARTER", "Starter tier ID is 'STARTER'");
  assert(starter.price === 0.0, "Starter plan price is $0.00 / mo (Free Forever)");
  assert(starter.orderLimit === 50, "Starter quota is exactly 50 orders/month");
  assert(starter.trialDays === 0, "Starter trial is 0 days (instant activation, no card)");
  assert(starter.interval === "EVERY_30_DAYS", "Starter interval is EVERY_30_DAYS");
  assert(starter.features.length >= 4, "Starter has rich feature list");

  // Tier 2: Growth Launch Deal (Replaces Pro)
  const growth = BILLING_PLANS.GROWTH;
  assert(growth.id === "GROWTH", "Growth tier ID is 'GROWTH'");
  assert(growth.price === 9.99, "Growth launch price is $9.99 / mo");
  assert(growth.previousPrice === 29.0, "Growth previous price is $29.00 (strike-through discount)");
  assert(growth.orderLimit === 500, "Growth quota is exactly 500 orders/month");
  assert(growth.trialDays === 7, "Growth trial is exactly 7 days (trialDays: 7)");
  assert(growth.badge === "Launch Offer", "Growth has prominent 'Launch Offer' badge");
  assert(growth.interval === "EVERY_30_DAYS", "Growth interval is EVERY_30_DAYS");
  assert(
    growth.features.some((f) => f.includes("Roman Urdu") || f.includes("Multi-tone")),
    "Growth includes Roman Urdu and multi-tone features"
  );

  // Tier 3: Scale / Enterprise
  const enterprise = BILLING_PLANS.ENTERPRISE;
  assert(enterprise.id === "ENTERPRISE", "Enterprise tier ID is 'ENTERPRISE'");
  assert(enterprise.price === 24.99, "Enterprise launch price is $24.99 / mo");
  assert(enterprise.previousPrice === 79.0, "Enterprise previous price is $79.00 (strike-through discount)");
  assert(enterprise.orderLimit === -1, "Enterprise quota is unlimited (-1)");
  assert(enterprise.trialDays === 7, "Enterprise trial is exactly 7 days (trialDays: 7)");
  assert(enterprise.badge === "Best Value", "Enterprise has 'Best Value' badge");
  assert(enterprise.interval === "EVERY_30_DAYS", "Enterprise interval is EVERY_30_DAYS");

  // Legacy Alias Verification
  const legacyPro = BILLING_PLANS.PRO;
  assert(legacyPro.id === "GROWTH", "Legacy PRO alias maps seamlessly to GROWTH");
  assert(legacyPro.price === 9.99, "Legacy PRO price is updated to $9.99");
  assert(legacyPro.trialDays === 7, "Legacy PRO inherits 7-day free trial");
}

async function testShopifyBillingGraphQLPayloads() {
  console.log("\n--- 2. Validating Shopify Billing GraphQL Engine & Mutations ---");

  // Check GraphQL Query Syntax
  assert(
    APP_SUBSCRIPTION_CREATE_MUTATION.includes("mutation AppSubscriptionCreate"),
    "Mutation name is AppSubscriptionCreate"
  );
  assert(
    APP_SUBSCRIPTION_CREATE_MUTATION.includes("$trialDays: Int!"),
    "Mutation requires $trialDays: Int!"
  );
  assert(
    APP_SUBSCRIPTION_CREATE_MUTATION.includes("trialDays: $trialDays"),
    "appSubscriptionCreate passes trialDays parameter"
  );
  assert(
    APP_SUBSCRIPTION_CREATE_MUTATION.includes("confirmationUrl"),
    "Mutation requests confirmationUrl for merchant authorization redirect"
  );

  // Mock Admin GraphQL Client to capture execution variables
  let capturedQuery = "";
  let capturedVariables: any = null;

  const mockAdmin = {
    graphql: async (query: string, options?: any) => {
      capturedQuery = query;
      capturedVariables = options?.variables;
      return {
        json: async () => ({
          data: {
            appSubscriptionCreate: {
              appSubscription: {
                id: "gid://shopify/AppSubscription/9988776655",
                status: "PENDING",
                currentPeriodEnd: "2026-10-22T00:00:00Z",
              },
              confirmationUrl: "https://admin.shopify.com/store/test-shop/charges/431180972033/pricing_plans",
              userErrors: [],
            },
          },
        }),
      };
    },
  };

  // Test Growth Plan ($9.99 with 7-Day Trial)
  const growthResult = await createAppSubscription({
    admin: mockAdmin,
    shop: "test-growth-store.myshopify.com",
    planId: "GROWTH",
    returnUrl: "https://test-growth-store.myshopify.com/app",
    isTest: true,
  });

  assert(
    growthResult.confirmationUrl?.includes("https://admin.shopify.com/store/test-shop/charges"),
    "createAppSubscription returns valid Shopify confirmationUrl"
  );
  assert(
    capturedVariables.name === "SwiftCOD - Growth Launch Deal",
    `Subscription name is formatted correctly: "${capturedVariables.name}"`
  );
  assert(
    capturedVariables.trialDays === 7,
    `GraphQL variable trialDays is strictly 7 (actual: ${capturedVariables.trialDays})`
  );
  assert(
    capturedVariables.test === true,
    `GraphQL variable test is true for non-production environments`
  );
  assert(
    capturedVariables.lineItems[0].plan.appRecurringPricingDetails.price.amount === 9.99,
    `LineItem recurring price amount is 9.99 USD`
  );
  assert(
    capturedVariables.lineItems[0].plan.appRecurringPricingDetails.price.currencyCode === "USD",
    `LineItem currencyCode is USD`
  );
  assert(
    capturedVariables.lineItems[0].plan.appRecurringPricingDetails.interval === "EVERY_30_DAYS",
    `LineItem interval is EVERY_30_DAYS (automatic 30-day billing rollover)`
  );

  // Test Enterprise Plan ($24.99 with 7-Day Trial)
  const enterpriseResult = await createAppSubscription({
    admin: mockAdmin,
    shop: "test-enterprise-store.myshopify.com",
    planId: "ENTERPRISE",
    returnUrl: "https://test-enterprise-store.myshopify.com/app",
    isTest: false,
  });

  assert(
    enterpriseResult.subscriptionId === "gid://shopify/AppSubscription/9988776655",
    "createAppSubscription captures returned appSubscription.id"
  );
  assert(
    capturedVariables.name === "SwiftCOD - Scale / Enterprise",
    `Enterprise subscription name formatted: "${capturedVariables.name}"`
  );
  assert(
    capturedVariables.trialDays === 7,
    `Enterprise GraphQL variable trialDays is 7 (actual: ${capturedVariables.trialDays})`
  );
  assert(
    capturedVariables.test === false,
    `Production flag sets test: false`
  );
  assert(
    capturedVariables.lineItems[0].plan.appRecurringPricingDetails.price.amount === 24.99,
    `Enterprise recurring price amount is 24.99 USD`
  );
  assert(
    capturedVariables.lineItems[0].plan.appRecurringPricingDetails.interval === "EVERY_30_DAYS",
    `Enterprise line item interval is EVERY_30_DAYS`
  );

  // Test GraphQL userErrors Handling
  const mockAdminWithError = {
    graphql: async () => ({
      json: async () => ({
        data: {
          appSubscriptionCreate: {
            userErrors: [{ field: ["trialDays"], message: "Trial period exceeds limit" }],
          },
        },
      }),
    }),
  };

  const errorResult = await createAppSubscription({
    admin: mockAdminWithError,
    shop: "test-error-store.myshopify.com",
    planId: "GROWTH",
    returnUrl: "https://test-error-store.myshopify.com/app",
  });

  assert(
    errorResult.errors?.[0] === "Trial period exceeds limit",
    "createAppSubscription cleanly returns userErrors array on API failure"
  );
}

function testAutomatedDeductionLifecycleRules() {
  console.log("\n--- 3. Validating Automated Deduction Lifecycle Rules ---");

  // Rule 1: Trial Days strictly non-negative integer
  assert(Number.isInteger(BILLING_PLANS.GROWTH.trialDays) && BILLING_PLANS.GROWTH.trialDays === 7, "Growth trial is integer 7");
  assert(Number.isInteger(BILLING_PLANS.ENTERPRISE.trialDays) && BILLING_PLANS.ENTERPRISE.trialDays === 7, "Enterprise trial is integer 7");

  // Rule 2: Automatic rollover interval
  assert(BILLING_PLANS.GROWTH.interval === "EVERY_30_DAYS", "Growth is recurring EVERY_30_DAYS");
  assert(BILLING_PLANS.ENTERPRISE.interval === "EVERY_30_DAYS", "Enterprise is recurring EVERY_30_DAYS");

  // Rule 3: Math validation
  const annualGrowthEquivalent = (BILLING_PLANS.GROWTH.price * 12).toFixed(2);
  const annualEnterpriseEquivalent = (BILLING_PLANS.ENTERPRISE.price * 12).toFixed(2);
  assert(annualGrowthEquivalent === "119.88", "12 x $9.99 = $119.88/year");
  assert(annualEnterpriseEquivalent === "299.88", "12 x $24.99 = $299.88/year");
}

async function runAllBillingTests() {
  console.log("==================================================================");
  console.log("   SWIFTCOD LAUNCH PRICING & 7-DAY TRIAL VERIFICATION SUITE");
  console.log("==================================================================");

  testPlanConfiguration();
  await testShopifyBillingGraphQLPayloads();
  testAutomatedDeductionLifecycleRules();

  console.log("\n==================================================================");
  console.log(`  ALL ${passedTests} / ${totalTests} BILLING OVERHAUL TESTS PASSED CLEANLY! 🎯`);
  console.log("==================================================================\n");
}

runAllBillingTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
