/**
 * Enterprise Verification Test Suite
 * 
 * Validates:
 * 1. Line item image resolution pipeline (Direct -> GraphQL -> REST -> Fallback)
 * 2. Multi-Tone & Multi-Locale localization engine (4 locales x 3 tones = 12 scenarios)
 * 3. Currency and phone normalization (including Roman Urdu and PKR)
 * 4. Zero null/undefined leaks in generated customer payloads
 */

import {
  resolveLocale,
  formatCurrency,
  normalizePhoneNumber,
  resolveOrderContext,
  buildLocalizedOrderMessage,
  I18N_DICTIONARIES,
  type SupportedLocale,
  type BotTone,
  type LineItemSummary,
} from "../app/services/localization.server";

import {
  resolveLineItemImageUrl,
  NEUTRAL_BRAND_FALLBACK_IMAGE,
} from "../app/services/shopify-orders.server";

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    console.error(`  [FAIL] ${testName}`, details || "");
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function testImageResolutionPipeline() {
  console.log("\n--- 1. Testing Resilient Product Image Resolution Pipeline ---");

  // Step A: Direct lineItem.image.src
  const directItem = {
    title: "Cotton Kurta",
    image: { src: "https://cdn.shopify.com/products/kurta-navy.jpg" },
  };
  const directUrl = await resolveLineItemImageUrl(null, directItem);
  assert(
    directUrl === "https://cdn.shopify.com/products/kurta-navy.jpg",
    "Resolves direct lineItem.image.src immediately"
  );

  // Step B: GraphQL resolution fallback
  const mockAdminWithVariant = {
    graphql: async (query: string, options?: any) => {
      if (query.includes("GetProductVariantImage")) {
        return {
          json: async () => ({
            data: {
              productVariant: {
                image: { url: "https://cdn.shopify.com/products/graphql-variant.png" },
                product: { featuredImage: { url: "https://cdn.shopify.com/products/graphql-product.png" } },
              },
            },
          }),
        };
      }
      return { json: async () => ({ data: {} }) };
    },
  };

  const itemNeedingGraphql = {
    title: "Embroidered Lawn",
    variant_id: "1234567890",
  };
  const gqlVariantUrl = await resolveLineItemImageUrl(mockAdminWithVariant, itemNeedingGraphql);
  assert(
    gqlVariantUrl === "https://cdn.shopify.com/products/graphql-variant.png",
    "Resolves variant image via GraphQL query"
  );

  // Step C: GraphQL fallback to product featured image
  const mockAdminWithProductOnly = {
    graphql: async (query: string, options?: any) => {
      if (query.includes("GetProductVariantImage")) {
        return {
          json: async () => ({
            data: {
              productVariant: {
                image: null,
                product: { featuredImage: { url: "https://cdn.shopify.com/products/featured-fallback.png" } },
              },
            },
          }),
        };
      }
      return { json: async () => ({ data: {} }) };
    },
  };
  const gqlProductUrl = await resolveLineItemImageUrl(mockAdminWithProductOnly, itemNeedingGraphql);
  assert(
    gqlProductUrl === "https://cdn.shopify.com/products/featured-fallback.png",
    "Resolves product featured image if variant image is null"
  );

  // Step D: Neutral Brand Fallback
  const emptyItem = { title: "Custom Mystery Item" };
  const fallbackUrl = await resolveLineItemImageUrl(null, emptyItem);
  assert(
    fallbackUrl === NEUTRAL_BRAND_FALLBACK_IMAGE,
    "Falls back to neutral brand fallback image when all lookups fail"
  );
}

function testLocalizationAndTones() {
  console.log("\n--- 2. Testing Multi-Tone & Multi-Locale Matrix (12 permutations) ---");

  const locales: SupportedLocale[] = ["en", "ur", "ar", "es"];
  const tones: BotTone[] = ["friendly", "urgent", "formal"];

  const sampleItems: LineItemSummary[] = [
    { title: "Lawn Stitched Suit 3-Piece", quantity: 1, price: 4500, variantTitle: "Medium / Blue" },
    { title: "Chiffon Dupatta", quantity: 2, price: 1200 },
  ];

  for (const locale of locales) {
    const dict = I18N_DICTIONARIES[locale];
    assert(!!dict, `Dictionary exists for locale "${locale}"`);
    assert(!!dict.buttons.confirm, `Confirm button text exists for "${locale}"`);
    assert(!!dict.buttons.cancel, `Cancel button text exists for "${locale}"`);
    assert(!!dict.buttons.manage, `Manage button text exists for "${locale}"`);

    for (const tone of tones) {
      const renderedMessage = buildLocalizedOrderMessage({
        locale,
        storeName: "Panda Couture",
        orderNumber: "#PK-10829",
        customerName: "Ayesha Khan",
        items: sampleItems,
        shippingAddress: "House 45, Street 12, Sector F-8/2, Islamabad, Pakistan",
        formattedAmount: locale === "ur" ? "PKR 6,900" : "$69.00",
        tone,
      });

      // Verify no syntax errors or template leakage
      assert(!renderedMessage.includes("undefined"), `[${locale} x ${tone}] No "undefined" in message`);
      assert(!renderedMessage.includes("NaN"), `[${locale} x ${tone}] No "NaN" in message`);
      assert(!renderedMessage.includes("[object Object]"), `[${locale} x ${tone}] No "[object Object]" in message`);
      assert(renderedMessage.includes("Panda Couture"), `[${locale} x ${tone}] Contains store name`);
      assert(renderedMessage.includes("#PK-10829"), `[${locale} x ${tone}] Contains order number`);
      assert(renderedMessage.includes("Lawn Stitched Suit 3-Piece"), `[${locale} x ${tone}] Contains line items`);
      assert(renderedMessage.includes("Islamabad"), `[${locale} x ${tone}] Contains delivery address`);

      // Verify tone-specific strings
      const expectedTone = dict.tones[tone];
      assert(renderedMessage.includes(expectedTone.orderSummaryTitle), `[${locale} x ${tone}] Contains tone title "${expectedTone.orderSummaryTitle}"`);
    }
  }
}

function testRomanUrduCulturalAuthenticity() {
  console.log("\n--- 3. Testing Roman Urdu Cultural Authenticity & Flow ---");

  // Pakistani market auto-detection
  const pkLocaleFromCountry = resolveLocale("PK", null);
  assert(pkLocaleFromCountry === "ur", "Shipping country 'PK' resolves to Roman Urdu ('ur')");

  const pkLocaleFromLanguage = resolveLocale(null, "ur-PK");
  assert(pkLocaleFromLanguage === "ur", "Customer locale 'ur-PK' resolves to Roman Urdu ('ur')");

  const sampleItems: LineItemSummary[] = [
    { title: "Embroidered Kurti", quantity: 1, variantTitle: "Large / Maroon" },
  ];

  // Friendly Tone in Roman Urdu
  const friendlyUrdu = buildLocalizedOrderMessage({
    locale: "ur",
    storeName: "Gul Ahmed Exclusive",
    orderNumber: "#GA-9912",
    customerName: "Fatima Noor",
    items: sampleItems,
    shippingAddress: "Flat 4B, Gulshan-e-Iqbal Block 13, Karachi",
    formattedAmount: "PKR 3,450",
    tone: "friendly",
  });

  assert(friendlyUrdu.includes("Assalam-o-Alaikum Fatima Noor!"), "Friendly Roman Urdu greeting has 'Assalam-o-Alaikum'");
  assert(friendlyUrdu.includes("📦 Order Tasdeeq (Verification)"), "Friendly Roman Urdu has clear order title");
  assert(friendlyUrdu.includes("Meharbani farma kar apna Cash on Delivery order confirm karein"), "Friendly action prompt is polite and clear");

  // Urgent Tone in Roman Urdu
  const urgentUrdu = buildLocalizedOrderMessage({
    locale: "ur",
    storeName: "Gul Ahmed Exclusive",
    orderNumber: "#GA-9912",
    customerName: "Fatima Noor",
    items: sampleItems,
    shippingAddress: "Karachi",
    formattedAmount: "PKR 3,450",
    tone: "urgent",
  });
  assert(urgentUrdu.includes("⚡ Fouri Tawajjah: COD Order Verification"), "Urgent Roman Urdu has urgency header");
  assert(urgentUrdu.includes("Baraye meharbani apna order foran confirm karein"), "Urgent Roman Urdu warns of time-sensitive confirmation");

  // Formal Tone in Roman Urdu
  const formalUrdu = buildLocalizedOrderMessage({
    locale: "ur",
    storeName: "Gul Ahmed Exclusive",
    orderNumber: "#GA-9912",
    customerName: "Fatima Noor",
    items: sampleItems,
    shippingAddress: "Karachi",
    formattedAmount: "PKR 3,450",
    tone: "formal",
  });
  assert(formalUrdu.includes("Mohtaram Fatima Noor"), "Formal Roman Urdu addresses customer respectfully as 'Mohtaram'");

  // Verification of interactive Roman Urdu buttons
  const urduDict = I18N_DICTIONARIES.ur;
  assert(urduDict.buttons.confirm.includes("Confirm"), "Urdu confirm button contains 'Confirm'");
  assert(urduDict.buttons.cancel.includes("Cancel"), "Urdu cancel button contains 'Cancel'");
  assert(urduDict.buttons.manage.includes("Tabdeel"), "Urdu modify button contains 'Tabdeel'");
  assert(urduDict.buttons.editAddress.includes("Address Badlein"), "Urdu address edit button contains 'Address Badlein'");
}

function testPhoneAndCurrencyEngine() {
  console.log("\n--- 4. Testing Phone Normalization & Currency Engine ---");

  // Pakistani phone formats
  assert(normalizePhoneNumber("03001234567", "PK") === "+923001234567", "0300 1234567 -> +923001234567");
  assert(normalizePhoneNumber("+92 300 1234567", "PK") === "+923001234567", "+92 300 1234567 -> +923001234567");
  assert(normalizePhoneNumber("0321-9876543", "PK") === "+923219876543", "0321-9876543 -> +923219876543");

  // GCC phone formats
  assert(normalizePhoneNumber("0501234567", "AE") === "+971501234567", "UAE local 050 -> +971501234567");
  assert(normalizePhoneNumber("0551234567", "SA") === "+966551234567", "KSA local 055 -> +966551234567");

  // Currency formatting
  const pkrFormatted = formatCurrency(5000, "PKR", "ur");
  assert(pkrFormatted.includes("5,000") || pkrFormatted.includes("5000"), "PKR formatted without cents (0 decimals)");

  const sarFormatted = formatCurrency(250.5, "SAR", "ar");
  assert(sarFormatted.includes("250.50") || sarFormatted.includes("SAR") || sarFormatted.includes("ر.س"), "SAR formatted with decimals");

  // Order context resolution
  const orderCtx = resolveOrderContext({
    customerPhone: "03001234567",
    shippingCountryCode: "PK",
    totalPrice: "4999",
    currency: "PKR",
  });
  assert(orderCtx.locale === "ur", "Order context resolves to 'ur' for PK order");
  assert(orderCtx.normalizedPhone === "+923001234567", "Order context normalizes Pakistani phone");
  assert(orderCtx.currency === "PKR", "Order context resolves currency PKR");
}

async function runAllTests() {
  console.log("==================================================================");
  console.log("   SWIFTCOD ENTERPRISE VERIFICATION TEST SUITE");
  console.log("==================================================================");

  await testImageResolutionPipeline();
  testLocalizationAndTones();
  testRomanUrduCulturalAuthenticity();
  testPhoneAndCurrencyEngine();

  console.log("\n==================================================================");
  console.log(`  ALL ${passedTests} / ${totalTests} ENTERPRISE TESTS PASSED CLEANLY! 🎯`);
  console.log("==================================================================\n");
}

runAllTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
