# SwiftCOD: Shopify App Store Submission & Review Checklist

This document consolidates all direct dashboard links, field-by-field copy, legal endpoints, pricing configurations, and visual assets required for immediate submission to the **Shopify App Store**.

---

## 1. Direct Shopify Dashboard & Store Links

| Resource | Direct URL | Description |
| :--- | :--- | :--- |
| **Shopify Partners App Overview** | [dev.shopify.com/.../apps/431180972033](https://dev.shopify.com/dashboard/238849299/apps/431180972033) | Central configuration and API client controls |
| **Latest Released App Version** | [dev.shopify.com/.../versions/1164537987073](https://dev.shopify.com/dashboard/238849299/apps/431180972033/versions/1164537987073) | `swiftcod-whatsapp-verify-2` active release |
| **App Store Listing Form** | [dev.shopify.com/.../apps/431180972033/listing](https://dev.shopify.com/dashboard/238849299/apps/431180972033/listing) | Official submission form for public listing |
| **Distribution & Review Status** | [dev.shopify.com/.../apps/431180972033/distribution](https://dev.shopify.com/dashboard/238849299/apps/431180972033/distribution) | App Store review request & public distribution |
| **Development Test Store** | [admin.shopify.com/store/ahmed-cod-test](https://admin.shopify.com/store/ahmed-cod-test) | Merchant test store for QA order placement |
| **Live Edge Gateway** | [agencies-fur-dealt-devices.trycloudflare.com](https://agencies-fur-dealt-devices.trycloudflare.com) | Active Cloudflare tunnel endpoint |

---

## 2. Field-by-Field Listing Form Inputs (Ready to Copy & Paste)

### A. App Name & Tagline
* **App Name (Limit: 30 chars):**
  ```text
  SwiftCOD: WhatsApp Verify
  ```
* **App Tagline / Subtitle (Limit: 60 chars):**
  ```text
  Stop fake COD orders & cut RTO with 1-click WhatsApp verify
  ```

---

### B. Key Features (3 Core Highlights for Search Cards)
1. **1-Click WhatsApp Verification:** Native interactive [Confirm Order] and [Cancel Order] buttons delivered seconds after checkout.
2. **Auto-Cancel & Restock Engine:** Automatically voids fake/rejected orders in Shopify and restores inventory to stock.
3. **Loss-Saved Financial Analytics:** Real-time dashboard showing exact currency saved based on courier return charges.

---

### C. Detailed Description (Paste into App Store Markdown Editor)
```markdown
### Stop Losing Money to Fake Cash on Delivery (COD) Orders and RTO Penalties

Cash on Delivery drives e-commerce across emerging markets, but Return-to-Origin (RTO) courier fees severely damage merchant profit margins. When buyers enter wrong phone numbers, place impulse orders, or refuse packages at the doorstep, merchants pay $3 to $8 in courier penalty fees per rejected parcel.

### The Solution: SwiftCOD Automated WhatsApp 1-Click Verification

SwiftCOD replaces slow, expensive phone call centers with an instant, interactive WhatsApp verification flow:

1. **Instant Checkout Capture:** As soon as a customer places a Cash on Delivery order, SwiftCOD normalizes their phone number to international E.164 standard and triggers a branded WhatsApp notification.
2. **Interactive 1-Click Decision:** The customer taps native quick-reply buttons — **[🟢 Confirm Order]** or **[🔴 Cancel Order]** — with zero typing, no passwords, and no login required.
3. **Automated Warehouse Tagging:** Confirmed orders receive the `COD-Confirmed` tag in Shopify admin so warehouse staff can pack and dispatch with complete confidence.
4. **Auto-Cancel & Restock Automation:** Cancelled or rejected orders are stamped with `COD-Cancelled`, automatically cancelled in Shopify with payment marked voided, and line items immediately restocked to active inventory.
5. **Auto-Expiry for Unattended Orders:** Orders unverified after 12h, 24h, or 48h are tagged `COD-Expired` to prevent dispatching parcels to ghost buyers.

### Why Merchants Choose SwiftCOD:
• **Zero-Config SaaS Convenience:** No complex Meta Developer setups, System Users, or API tokens required from the merchant.
• **Live Financial ROI Dashboard:** Track intercepted fake deliveries and see net courier cash saved in your local store currency.
• **Multi-Country Support:** Standardized carrier routing across Pakistan, India, UAE, Saudi Arabia, and 190+ countries.
• **GDPR & CCPA Certified:** Complete compliance with privacy standards and mandatory Shopify data protection webhooks.
```

---

### D. Search Keywords / Categories
* **Primary Category:** Orders & shipping > Fraud & risk management
* **Secondary Category:** Marketing & conversion > Customer communication
* **Search Tags:**
  ```text
  Cash on Delivery, COD Verification, WhatsApp, RTO Reduction, Order Confirmation, Fraud Prevention, Auto Cancel, Order Tagging, Courier Return, COD OTP
  ```

---

## 3. Pricing Plan Configuration (Shopify AppSubscription API)

### Tier 1: Starter (Free Forever)
* **Plan Name:** Starter
* **Price:** `$0.00 / month`
* **Free Trial:** None (Free forever)
* **Included Orders:** 20 verified orders/month
* **Overage:** Upgrade prompt upon reaching quota
* **Description:** Perfect for new stores testing WhatsApp COD verification. Includes 1-click buttons, core tags (`COD-Confirmed`), and standard support.

### Tier 2: Launch Special (Limited Offer)
* **Plan Name:** Launch Special
* **Price:** `$5.99 / month` *(Discounted from $9.99)*
* **Trial Period:** 7-Day Trial ($1.00 payment method authentication charge)
* **Included Orders:** 400 verified orders/month
* **Overage Rate:** `$0.015 per additional order`
* **Description:** Ideal for growing D2C brands. Includes Auto-Cancel & Restock engine, 12h/24h auto-expiry rules, and Financial ROI loss analytics.

### Tier 3: Growth Plan
* **Plan Name:** Growth Plan
* **Price:** `$14.99 / month` *(Discounted from $19.99)*
* **Trial Period:** 7-Day 100% Free Trial ($0.00 upfront)
* **Included Orders:** 1,500 verified orders/month
* **Overage Rate:** `$0.010 per additional order`
* **Description:** For established stores. Includes 1,500 monthly orders, low overage rates, custom admin tagging, and priority 24-hour support.

### Tier 4: Scale / Pro Plan
* **Plan Name:** Scale / Pro Plan
* **Price:** `$39.99 / month` *(Discounted from $49.99)*
* **Trial Period:** 7-Day 100% Free Trial ($0.00 upfront)
* **Included Orders:** 5,000 verified orders/month
* **Overage Rate:** `$0.006 per additional order`
* **Description:** For high-volume merchants. Includes priority WhatsApp dispatch queue, multi-country routing fallback, CSV verification export, and dedicated account manager.

#### Mandatory Billing Disclosures for Merchant View:
* *All recurring subscriptions and overages run through Shopify's official AppSubscription API and are billed in the merchant's local currency.*
* *Paid subscriptions activate automatically after the 7-day trial using the payment method on file.*
* *Merchants receive native Shopify transactional billing receipts, trial reminders, and invoice emails.*

---

## 4. Visual Assets Pack (`store-listing/mockups/`)

All graphical assets are rendered in standard Shopify App Store aspect ratios and resolutions:

| Asset | File Location | Dimensions | Purpose |
| :--- | :--- | :--- | :--- |
| **App Icon** | [`store-listing/mockups/app-icon-1200x1200.svg`](file:///e:/cod-whatsapp-verify/store-listing/mockups/app-icon-1200x1200.svg) | 1200 × 1200 px | App Store tile, search results & admin app icon |
| **Screen 1: Dashboard ROI** | [`store-listing/mockups/screen1-dashboard-roi.svg`](file:///e:/cod-whatsapp-verify/store-listing/mockups/screen1-dashboard-roi.svg) | 1600 × 1000 px | Hero screenshot showing courier cash saved |
| **Screen 2: Interactive WhatsApp UI** | [`store-listing/mockups/screen2-whatsapp-interactive.svg`](file:///e:/cod-whatsapp-verify/store-listing/mockups/screen2-whatsapp-interactive.svg) | 1600 × 1000 px | Mobile mockup showing 1-click quick-reply buttons |
| **Screen 3: Shopify Admin Tagging** | [`store-listing/mockups/screen3-shopify-tags.svg`](file:///e:/cod-whatsapp-verify/store-listing/mockups/screen3-shopify-tags.svg) | 1600 × 1000 px | Real-time `COD-Confirmed` & `COD-Cancelled` tags |
| **Screen 4: Auto-Restocking Engine** | [`store-listing/mockups/screen4-auto-restock.svg`](file:///e:/cod-whatsapp-verify/store-listing/mockups/screen4-auto-restock.svg) | 1600 × 1000 px | 3-stage cancellation & inventory restoration pipeline |
| **Screen 5: Zero-Code Setup** | [`store-listing/mockups/screen5-zero-code-setup.svg`](file:///e:/cod-whatsapp-verify/store-listing/mockups/screen5-zero-code-setup.svg) | 1600 × 1000 px | Polaris toggle controls and compliance badges |

---

## 5. Privacy, Legal & Reviewer Instructions

* **Privacy Policy URL:** `https://agencies-fur-dealt-devices.trycloudflare.com/docs/privacy-policy.html`  
  *(Markdown source: [`docs/PRIVACY_POLICY.md`](file:///e:/cod-whatsapp-verify/docs/PRIVACY_POLICY.md))*
* **Terms of Service URL:** `https://agencies-fur-dealt-devices.trycloudflare.com/docs/terms-of-service.html`  
  *(Markdown source: [`docs/TERMS_OF_SERVICE.md`](file:///e:/cod-whatsapp-verify/docs/TERMS_OF_SERVICE.md))*
* **Shopify QA Review Instructions:** [`docs/SHOPIFY_REVIEW_INSTRUCTIONS.md`](file:///e:/cod-whatsapp-verify/docs/SHOPIFY_REVIEW_INSTRUCTIONS.md)
* **Health Check Endpoint:** `https://agencies-fur-dealt-devices.trycloudflare.com/api/health`
* **Mandatory Webhook Handshake:** `https://agencies-fur-dealt-devices.trycloudflare.com/api/whatsapp/webhook`
