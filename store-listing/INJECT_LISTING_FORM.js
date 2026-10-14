/**
 * SwiftCOD: Automated Shopify App Store Listing Form Injector (ASO Optimized)
 * 
 * Injects keyword-optimized metadata, character-constrained titles, descriptions,
 * feature highlights, and 3-tier pricing into the Shopify Partners App Store listing form.
 */

const LISTING_METADATA = {
  // STRICT CONSTRAINT: Maximum 30 characters
  app_name: "SwiftCOD: WhatsApp COD Verify", // Exactly 29 characters

  // STRICT CONSTRAINT: Maximum 62 characters
  app_subtitle: "1-Click WhatsApp COD verification to reduce RTO & fake orders", // Exactly 61 characters

  // Primary Category & Subcategory Taxonomy
  category: "Orders and shipping",
  subcategory: "Order management",

  // High-Intent Search Keywords (Max allowed indexing tags: 9)
  search_terms: [
    "whatsapp cod",
    "cash on delivery",
    "reduce rto",
    "order verification",
    "cod confirmation",
    "fake orders",
    "otp verification",
    "whatsapp notification",
    "restock inventory"
  ],

  // Synchronized Tier Pricing Structure
  pricing_plans: [
    {
      name: "Free Starter",
      price: 0.00,
      currency: "USD",
      interval: "EVERY_30_DAYS",
      trial_days: 0,
      features: [
        "50 COD verifications / month",
        "Standard order tagging (COD-Confirmed, COD-Cancelled)",
        "Automated cancellation & restock",
        "Free forever (no credit card required)"
      ]
    },
    {
      name: "Growth Launch Deal",
      price: 9.99,
      currency: "USD",
      interval: "EVERY_30_DAYS",
      trial_days: 7,
      badge: "Launch Offer",
      features: [
        "500 COD verifications / month",
        "Dynamic GraphQL product image header",
        "Authentic Roman Urdu + English + Arabic localization",
        "Multi-tone engine (Friendly, Urgent, Formal)",
        "WhatsApp native GPS location pin capture",
        "Automatic courier loss savings calculator"
      ]
    },
    {
      name: "Scale / Enterprise",
      price: 24.99,
      currency: "USD",
      interval: "EVERY_30_DAYS",
      trial_days: 7,
      badge: "Best Value",
      features: [
        "Unlimited COD verifications",
        "All Growth features included",
        "Priority webhook & API queue processing",
        "Dedicated onboarding & custom tag workflows",
        "24/7 Priority support"
      ]
    }
  ],

  compliance: {
    privacyUrl: "https://swiftcod-whatsapp-verify.onrender.com/privacy",
    tosUrl: "https://swiftcod-whatsapp-verify.onrender.com/terms",
    testStore: "ahmed-cod-test.myshopify.com"
  }
};

const DETAILED_DESCRIPTION = `Stop losing courier shipping fees to fake, unconfirmed, or abandoned Cash on Delivery (COD) orders. 

SwiftCOD: WhatsApp COD Verify empowers merchants across Pakistan, the GCC, and emerging COD markets to automate order confirmation instantly via WhatsApp. As soon as a customer places a COD order, SwiftCOD sends an automated, interactive WhatsApp message featuring the ordered product's image and 1-click action buttons: Confirm, Modify Address, or Cancel.

Why Leading COD Brands Rely on SwiftCOD:
• Eliminate Fake Orders: Filter out typos, bogus phone numbers, and non-serious buyers before warehouse packaging.
• Instant 1-Click Verification: High-converting interactive buttons remove the friction of manual phone calls, SMS OTPs, and login portals.
• Auto-Cancel & Inventory Restock: Automatically cancel unverified or rejected orders via Shopify GraphQL, restocking inventory back to your catalog immediately.
• Reduce Courier Delivery Failures: Allow customers to correct delivery addresses via conversational text or share their native WhatsApp GPS Location Pin directly with your delivery team.
• Cultural Localization & Tones: Out-of-the-box support for authentic Roman Urdu, English, and Arabic, tailored to Friendly, Formal, or Urgent messaging tones.`;

const FEATURE_HIGHLIGHTS = [
  {
    title: "1-Click WhatsApp Verification",
    description: "Buyers confirm, cancel, or modify their COD orders instantly with native interactive buttons directly inside WhatsApp."
  },
  {
    title: "Automatic Inventory Restocking",
    description: "Void bogus orders before fulfillment. Canceled orders automatically restock catalog quantities with restock: true via GraphQL."
  },
  {
    title: "WhatsApp GPS Location Pin",
    description: "Eliminate RTO courier rejections by capturing exact Google Maps delivery pins shared by customers via WhatsApp."
  }
];

const REVIEWER_NOTES = `SwiftCOD: WhatsApp Verify Reviewer QA Testing Instructions:
- Test Development Store: ahmed-cod-test.myshopify.com
- Production Cloud URL: https://swiftcod-whatsapp-verify.onrender.com
- Health Check Probe: https://swiftcod-whatsapp-verify.onrender.com/api/health (HTTP 200 OK)
- Privacy Compliance Endpoints:
  * /api/webhooks/customers-data-request
  * /api/webhooks/customers-redact
  * /api/webhooks/shop-redact
- Test Steps:
  1. Open embedded app in ahmed-cod-test admin.
  2. Place a test order with Cash on Delivery payment method.
  3. Order appears in SwiftCOD dashboard.
  4. WhatsApp interactive quick reply triggers CONFIRM -> tags COD-Confirmed.
  5. WhatsApp CANCEL triggers auto-cancellation and restores inventory (+1 restock).
  6. Interactive EDIT_ADDRESS updates shipping address in Shopify Admin and tags COD-Address-Modified.`;

// Helper to trigger React / Polaris synthetic input events in DOM
function setNativeValue(element, value) {
  if (!element) return false;
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.dispatchEvent(new Event("blur", { bubbles: true }));
  return true;
}

function injectListingForm() {
  if (typeof document === "undefined") {
    console.warn("injectListingForm requires a browser DOM environment.");
    return null;
  }

  console.log("%c🚀 Starting SwiftCOD ASO-Optimized Listing Form Injection...", "color: #008060; font-size: 16px; font-weight: bold;");

  const results = {
    appName: false,
    subtitle: false,
    description: false,
    features: 0,
    searchTerms: false,
    category: false,
    pricingPlans: 0,
    privacyUrl: false,
    tosUrl: false,
    reviewerNotes: false
  };

  // 1. App Name (Max 30 chars)
  const nameInput = document.querySelector('#app-name, input[name*="name"], input[name*="title"], input[id*="name"], input[placeholder*="App name" i]');
  if (nameInput) {
    results.appName = setNativeValue(nameInput, LISTING_METADATA.app_name);
    console.log("✔ Injected App Name:", LISTING_METADATA.app_name, `(${LISTING_METADATA.app_name.length} chars)`);
  }

  // 2. App Subtitle / Tagline (Max 62 chars)
  const subtitleInput = document.querySelector('#app-tagline, #app-subtitle, input[name*="tagline"], input[name*="subtitle"], input[placeholder*="tagline" i], input[placeholder*="catchy" i]');
  if (subtitleInput) {
    const max = subtitleInput.maxLength && subtitleInput.maxLength > 0 ? subtitleInput.maxLength : 62;
    const val = LISTING_METADATA.app_subtitle.length <= max ? LISTING_METADATA.app_subtitle : LISTING_METADATA.app_subtitle.slice(0, max);
    results.subtitle = setNativeValue(subtitleInput, val);
    console.log("✔ Injected Subtitle:", val, `(${val.length} chars)`);
  }

  // 3. Detailed Description
  const descInput = document.querySelector('#app-description, textarea[name*="description"], textarea[placeholder*="description" i], div[contenteditable="true"]');
  if (descInput) {
    if (descInput.tagName === "TEXTAREA") {
      results.description = setNativeValue(descInput, DETAILED_DESCRIPTION);
    } else {
      descInput.innerText = DETAILED_DESCRIPTION;
      descInput.dispatchEvent(new Event("input", { bubbles: true }));
      results.description = true;
    }
    console.log("✔ Injected Detailed Description (Keyword Optimized)");
  }

  // 4. Feature Highlights (Structured 3-Column Pitch)
  const featureTitleInputs = Array.from(document.querySelectorAll('input[name*="feature"][name*="title"], input[placeholder*="feature" i][placeholder*="title" i], [data-testid*="feature-title"] input'));
  const featureDescInputs = Array.from(document.querySelectorAll('textarea[name*="feature"], input[name*="feature"][name*="description"], [data-testid*="feature-desc"] input, [data-testid*="feature-desc"] textarea'));

  if (featureTitleInputs.length > 0) {
    FEATURE_HIGHLIGHTS.forEach((feat, idx) => {
      if (featureTitleInputs[idx]) {
        setNativeValue(featureTitleInputs[idx], feat.title);
        results.features++;
      }
      if (featureDescInputs[idx]) {
        setNativeValue(featureDescInputs[idx], feat.description);
      }
    });
    console.log(`✔ Injected ${results.features} Structured Feature Highlights`);
  } else {
    // Fallback: simple feature inputs
    const genericFeatureInputs = Array.from(document.querySelectorAll('input[name*="feature"], input[placeholder*="feature" i]'));
    genericFeatureInputs.slice(0, FEATURE_HIGHLIGHTS.length).forEach((input, idx) => {
      if (setNativeValue(input, `${FEATURE_HIGHLIGHTS[idx].title}: ${FEATURE_HIGHLIGHTS[idx].description}`)) {
        results.features++;
      }
    });
    console.log(`✔ Injected ${results.features} Feature Highlights (Single-field format)`);
  }

  // 5. Search Terms / Keywords
  const tagsInput = document.querySelector('#app-search-terms, input[name*="tag"], input[name*="search_terms"], input[placeholder*="keyword" i], input[placeholder*="tag" i]');
  if (tagsInput) {
    const formattedTags = LISTING_METADATA.search_terms.join(", ");
    results.searchTerms = setNativeValue(tagsInput, formattedTags);
    console.log("✔ Injected Search Terms:", formattedTags);
  }

  // 6. Category & Subcategory
  const categorySelect = document.querySelector('select[name*="category"], select[id*="category"]');
  if (categorySelect) {
    const matchingOption = Array.from(categorySelect.options).find((opt) => opt.text.toLowerCase().includes("order"));
    if (matchingOption) {
      categorySelect.value = matchingOption.value;
      categorySelect.dispatchEvent(new Event("change", { bubbles: true }));
      results.category = true;
      console.log("✔ Injected Category:", LISTING_METADATA.category);
    }
  }

  // 7. Compliance URLs
  const privacyInput = document.querySelector('input[name*="privacy"], input[placeholder*="privacy" i]');
  if (privacyInput) {
    results.privacyUrl = setNativeValue(privacyInput, LISTING_METADATA.compliance.privacyUrl);
    console.log("✔ Injected Privacy Policy URL");
  }

  const tosInput = document.querySelector('input[name*="terms"], input[placeholder*="terms" i]');
  if (tosInput) {
    results.tosUrl = setNativeValue(tosInput, LISTING_METADATA.compliance.tosUrl);
    console.log("✔ Injected Terms of Service URL");
  }

  // 8. Reviewer Notes
  const reviewerInput = document.querySelector('textarea[name*="reviewer"], textarea[name*="instructions"], textarea[placeholder*="reviewer" i], textarea[placeholder*="testing" i]');
  if (reviewerInput) {
    results.reviewerNotes = setNativeValue(reviewerInput, REVIEWER_NOTES);
    console.log("✔ Injected Reviewer Notes");
  }

  // 9. Pricing Tiers
  const planRows = Array.from(document.querySelectorAll('[data-testid*="plan"], tr:has(input[name*="plan"]), div:has(> input[name*="price"])'));
  if (planRows.length > 0) {
    LISTING_METADATA.pricing_plans.forEach((plan, idx) => {
      const row = planRows[idx];
      if (row) {
        const nameIn = row.querySelector('input[name*="name"], input[placeholder*="plan" i]');
        const priceIn = row.querySelector('input[name*="price"], input[placeholder*="price" i]');
        const termsIn = row.querySelector('input[name*="terms"], textarea[name*="terms"], input[placeholder*="term" i]');
        if (nameIn) setNativeValue(nameIn, plan.name);
        if (priceIn) setNativeValue(priceIn, plan.price.toFixed(2));
        if (termsIn) setNativeValue(termsIn, plan.features.join(" • "));
        results.pricingPlans++;
      }
    });
    console.log(`✔ Injected ${results.pricingPlans} Pricing Plans`);
  }

  console.log("%c=======================================================", "color: #008060;");
  console.log("%c   SWIFTCOD ASO INJECTION COMPLETE                     ", "color: #008060; font-weight: bold;");
  console.log("%c=======================================================", "color: #008060;");
  console.table(results);

  return results;
}

// Auto-run in browser console if not running in Node test environment
if (typeof window !== "undefined") {
  injectListingForm();
}

// Universal module export for test verification suites
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    LISTING_METADATA,
    DETAILED_DESCRIPTION,
    FEATURE_HIGHLIGHTS,
    REVIEWER_NOTES,
    setNativeValue,
    injectListingForm
  };
}
