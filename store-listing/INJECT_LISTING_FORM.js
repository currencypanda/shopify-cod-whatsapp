/**
 * SwiftCOD: Automated Shopify App Store Listing Form Injector
 * 
 * Injects all verified metadata, description, pricing tiers, and reviewer notes
 * into the Shopify Partners App Store listing form (React / Polaris compatible).
 */

(() => {
  console.log("%c🚀 Starting SwiftCOD App Store Listing Form Injection...", "color: #008060; font-size: 16px; font-weight: bold;");

  const DATA = {
    appName: "SwiftCOD: WhatsApp Verify",
    tagline: "Stop fake COD orders & cut RTO with 1-click WhatsApp verify",
    features: [
      "Automated WhatsApp 1-Click Confirmation & Cancellation",
      "Real-time Shopify Admin Order Tagging (COD-Confirmed / COD-Cancelled)",
      "Auto-Restock & Inventory Recovery Engine",
      "Courier Loss-Saved ROI Financial Dashboard"
    ],
    searchTags: "Cash on Delivery, COD Verification, WhatsApp, RTO Reduction, Order Confirmation, Fraud Prevention, Auto Cancel",
    testStore: "ahmed-cod-test.myshopify.com",
    privacyUrl: "https://agencies-fur-dealt-devices.trycloudflare.com/docs/privacy-policy.html",
    tosUrl: "https://agencies-fur-dealt-devices.trycloudflare.com/docs/terms-of-service.html",
    pricing: [
      { name: "Starter", price: "0.00", terms: "20 verified orders/mo included. Core auto-tagging." },
      { name: "Launch Special", price: "5.99", terms: "400 verified orders/mo ($0.015 overage). 7-day trial with $1.00 verification fee." },
      { name: "Growth Plan", price: "14.99", terms: "1,500 verified orders/mo ($0.010 overage). 7-day 100% free trial." },
      { name: "Scale / Pro Plan", price: "39.99", terms: "5,000 verified orders/mo ($0.006 overage). Priority WhatsApp dispatch." }
    ],
    detailedDescription: `### Stop Losing Money to Fake Cash on Delivery (COD) Orders and RTO Penalties

Cash on Delivery drives e-commerce across emerging markets, but Return-to-Origin (RTO) courier fees severely damage merchant profit margins. When buyers enter wrong phone numbers, place impulse orders, or refuse packages at the doorstep, merchants pay $3 to $8 in courier penalty fees per rejected parcel.

### The Solution: SwiftCOD Automated WhatsApp 1-Click Verification

SwiftCOD replaces slow, expensive phone call centers with an instant, interactive WhatsApp verification flow:

1. **Instant Checkout Capture:** As soon as a customer places a Cash on Delivery order, SwiftCOD normalizes their phone number to international E.164 standard and triggers a branded WhatsApp notification.
2. **Interactive 1-Click Decision:** The customer taps native quick-reply buttons — **[🟢 Confirm Order]** or **[🔴 Cancel Order]** — with zero typing, no passwords, and no login required.
3. **Automated Warehouse Tagging:** Confirmed orders receive the \`COD-Confirmed\` tag in Shopify admin so warehouse staff can pack and dispatch with complete confidence.
4. **Auto-Cancel & Restock Automation:** Cancelled or rejected orders are stamped with \`COD-Cancelled\`, automatically cancelled in Shopify with payment marked voided, and line items immediately restocked to active inventory.
5. **Auto-Expiry for Unattended Orders:** Orders unverified after 12h, 24h, or 48h are tagged \`COD-Expired\` to prevent dispatching parcels to ghost buyers.

### Why Merchants Choose SwiftCOD:
• **Zero-Config SaaS Convenience:** No complex Meta Developer setups, System Users, or API tokens required from the merchant.
• **Live Financial ROI Dashboard:** Track intercepted fake deliveries and see net courier cash saved in your local store currency.
• **Multi-Country Support:** Standardized carrier routing across Pakistan, India, UAE, Saudi Arabia, and 190+ countries.
• **GDPR & CCPA Certified:** Complete compliance with privacy standards and mandatory Shopify data protection webhooks.`,
    reviewerNotes: `SwiftCOD: WhatsApp Verify Reviewer QA Testing Instructions:
- Test Development Store: ahmed-cod-test.myshopify.com
- Tunnel Gateway: https://agencies-fur-dealt-devices.trycloudflare.com
- Health Check: https://agencies-fur-dealt-devices.trycloudflare.com/api/health (HTTP 200 OK)
- Privacy Compliance Endpoints: /webhooks/customers/data_request, /webhooks/customers/redact, /webhooks/shop/redact
- Test Steps:
  1. Open embedded app in ahmed-cod-test admin.
  2. Place a test order with Cash on Delivery payment method.
  3. Order appears as PENDING in SwiftCOD dashboard.
  4. WhatsApp interactive quick reply triggers CONFIRM -> tags COD-Confirmed.
  5. WhatsApp CANCEL triggers auto-cancellation and restores inventory (+1 restock).`
  };

  // Helper to trigger React / Polaris synthetic input events
  function setNativeValue(element, value) {
    if (!element) return false;
    const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    
    if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
      prototypeValueSetter.call(element, value);
    } else if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  const results = {
    appName: false,
    tagline: false,
    description: false,
    features: 0,
    searchTags: false,
    privacyUrl: false,
    tosUrl: false,
    reviewerNotes: false
  };

  // 1. App Name
  const nameInput = document.querySelector('input[name*="name"], input[name*="title"], input[id*="name"], input[placeholder*="App name" i]');
  if (nameInput) {
    results.appName = setNativeValue(nameInput, DATA.appName);
    console.log("✔ Injected App Name:", DATA.appName);
  }

  // 2. Tagline
  const taglineInput = document.querySelector('input[name*="tagline"], input[name*="subtitle"], input[placeholder*="tagline" i], input[placeholder*="catchy" i]');
  if (taglineInput) {
    results.tagline = setNativeValue(taglineInput, DATA.tagline);
    console.log("✔ Injected Tagline:", DATA.tagline);
  }

  // 3. Detailed Description
  const descInput = document.querySelector('textarea[name*="description"], textarea[placeholder*="description" i], div[contenteditable="true"]');
  if (descInput) {
    if (descInput.tagName === 'TEXTAREA') {
      results.description = setNativeValue(descInput, DATA.detailedDescription);
    } else {
      descInput.innerText = DATA.detailedDescription;
      descInput.dispatchEvent(new Event('input', { bubbles: true }));
      results.description = true;
    }
    console.log("✔ Injected Detailed Description");
  }

  // 4. Feature Bullets
  const featureInputs = Array.from(document.querySelectorAll('input[name*="feature"], input[placeholder*="feature" i]'));
  featureInputs.slice(0, DATA.features.length).forEach((input, idx) => {
    if (setNativeValue(input, DATA.features[idx])) {
      results.features++;
    }
  });
  console.log(`✔ Injected ${results.features} Key Feature Bullets`);

  // 5. Search tags
  const tagsInput = document.querySelector('input[name*="tag"], input[placeholder*="keyword" i], input[placeholder*="tag" i]');
  if (tagsInput) {
    results.searchTags = setNativeValue(tagsInput, DATA.searchTags);
    console.log("✔ Injected Search Tags");
  }

  // 6. Privacy & Terms URLs
  const privacyInput = document.querySelector('input[name*="privacy"], input[placeholder*="privacy" i]');
  if (privacyInput) {
    results.privacyUrl = setNativeValue(privacyInput, DATA.privacyUrl);
    console.log("✔ Injected Privacy Policy URL");
  }

  const tosInput = document.querySelector('input[name*="terms"], input[placeholder*="terms" i]');
  if (tosInput) {
    results.tosUrl = setNativeValue(tosInput, DATA.tosUrl);
    console.log("✔ Injected Terms of Service URL");
  }

  // 7. Reviewer Instructions
  const reviewerInput = document.querySelector('textarea[name*="reviewer"], textarea[name*="instructions"], textarea[placeholder*="reviewer" i], textarea[placeholder*="testing" i]');
  if (reviewerInput) {
    results.reviewerNotes = setNativeValue(reviewerInput, DATA.reviewerNotes);
    console.log("✔ Injected Reviewer Notes");
  }

  console.log("%c=======================================================", "color: #008060;");
  console.log("%c   SWIFTCOD LISTING INJECTION SUMMARY:                 ", "color: #008060; font-weight: bold;");
  console.log("%c=======================================================", "color: #008060;");
  console.table(results);

  return results;
})();
