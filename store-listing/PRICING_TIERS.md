# SwiftCOD: Pricing Tier Architecture & Automated Billing Disclosures

This document details the finalized pricing tier model, plan quotas, overage terms, and Shopify Billing API compliant disclosures for **SwiftCOD: WhatsApp Verify**.

---

## 1. Finalized Pricing Tier Summary Matrix

| Plan Tier | Price / Month | Monthly Included Orders | Extra Order Rate | Key Included Features | Target Merchant Profile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter (Free Forever)** | **$0.00** | **20 Orders** | Blocked / Upgrade Prompt | 1-Click WhatsApp buttons, Core Auto-Tagging (`COD-Confirmed`, `COD-Cancelled`), Standard Support | New Shopify stores testing COD verification |
| **Launch Special** | **$5.99** <br>*(Regular $9.99)* | **400 Orders** | **$0.015** / order | 7-day trial ($1.00 verification charge), Auto-Cancel & Restock Engine, 12h/24h Expiry Rules, ROI Dashboard | Early-stage D2C stores processing 100–400 monthly COD orders |
| **Growth Plan** | **$14.99** <br>*(Regular $19.99)* | **1,500 Orders** | **$0.010** / order | 7-day free trial, Full Auto-Restock & Expiry, Financial ROI Loss Analytics, Custom Admin Tags | Rapidly scaling brands processing 400–1,500 monthly orders |
| **Scale / Pro Plan** | **$39.99** <br>*(Regular $49.99)* | **5,000 Orders** | **$0.006** / order | 7-day free trial, Multi-country phone routing, Priority WhatsApp Dispatch Queue, CSV Audit Export | High-volume merchants processing 1,500–5,000+ monthly orders |

---

## 2. Detailed Plan Specifications

### Plan 1: Starter (Free Forever)
* **Monthly Subscription Fee:** `$0.00 / month`
* **Free Trial:** None required — 100% free forever upon installation.
* **Monthly Included Verifications:** **20 verified COD orders per month**.
* **Features Included:**
  * Automated WhatsApp 1-click confirmation & cancellation quick-reply buttons
  * Zero-config SaaS managed messaging (no Meta developer setup required)
  * Real-time Shopify Admin tags (`COD-Confirmed`, `COD-Cancelled`)
  * International phone number sanitization (E.164 formatting)
  * Standard email support
* **Quota Exhaustion Behavior:** Once 20 orders are reached in a monthly cycle, verification message dispatch pauses cleanly and the merchant is prompted to upgrade. Existing verified orders and tags remain intact.

---

### Plan 2: Launch Special ($5.99 / month — Limited Launch Offer)
* **Monthly Subscription Fee:** `$5.99 / month` *(Discounted from regular $9.99)*
* **Trial Structure:** **7-Day Trial** with an initial `$1.00 verification charge` applied to confirm merchant payment method authenticity on Shopify.
* **Monthly Included Verifications:** **400 verified COD orders per month**.
* **Overage Rate:** `$0.015 per additional order` (capped with merchant-defined Shopify usage limit).
* **Features Included:**
  * All Starter features
  * **Auto-Cancel & Restock Engine:** Automatically voids rejected orders in Shopify and returns stock to inventory
  * **Customizable Auto-Expiry Window:** Mark unattended orders as `COD-Expired` after 12h, 24h, or 48h
  * **Financial ROI & Loss-Saved Analytics:** Real-time dashboard showing exact currency saved from prevented RTO courier charges
  * **Custom Admin Tagging:** Configurable tag names to match existing warehouse ERP/WMS systems
  * Priority email support

---

### Plan 3: Growth Plan ($14.99 / month)
* **Monthly Subscription Fee:** `$14.99 / month` *(Discounted from regular $19.99)*
* **Trial Structure:** **7-Day 100% Free Trial** ($0.00 upfront).
* **Monthly Included Verifications:** **1,500 verified COD orders per month**.
* **Overage Rate:** `$0.010 per additional order`.
* **Features Included:**
  * All Launch Special features
  * Expanded 1,500 monthly verification quota
  * Ultra-low overage rate ($0.010/order)
  * Priority WhatsApp and email support (24-hour turnaround)
  * Advanced courier loss ROI reporting by geographic region

---

### Plan 4: Scale / Pro Plan ($39.99 / month)
* **Monthly Subscription Fee:** `$39.99 / month` *(Discounted from regular $49.99)*
* **Trial Structure:** **7-Day 100% Free Trial** ($0.00 upfront).
* **Monthly Included Verifications:** **5,000 verified COD orders per month**.
* **Overage Rate:** `$0.006 per additional order` *(High-volume wholesale tier)*.
* **Features Included:**
  * All Growth features
  * **Multi-Country Routing & Fallback:** Priority routing across Pakistan, India, GCC, and North Africa
  * **High-Speed WhatsApp Cloud Dispatch Queue:** Instantaneous delivery during flash sales and peak seasonal events
  * **Exportable Verification Logs:** Download full CSV audit trails of customer responses and response timestamps
  * Dedicated WhatsApp account manager & 4-hour SLA support

---

## 3. Automated Shopify Recurring Billing Disclosures

Shopify mandates clear, transparent disclosures regarding how recurring subscriptions, trials, and currency conversions operate. Below is the exact merchant disclosure copy implemented across the in-app subscription screen and Shopify App Store listing:

```text
Shopify Billing Terms & Conditions:

1. Unified Shopify AppSubscription API:
   • All subscriptions, plan changes, and usage overages are processed securely through Shopify's official AppSubscription API.
   • Charges appear directly on your regular 30-day recurring Shopify invoice alongside your standard Shopify store fees.

2. Local Currency Auto-Conversion:
   • While plan tiers are denominated in USD ($5.99, $14.99, $39.99), Shopify automatically converts all fees into your store's native billing currency (PKR, INR, AED, SAR, GBP, EUR, CAD, AUD, etc.) at live exchange rates during checkout confirmation.
   • Merchants are billed in their familiar home currency with zero foreign exchange fees or manual conversion friction.

3. 7-Day Trial & Automatic Subscription Activation:
   • Paid plans include a 7-day risk-free trial.
   • Upon conclusion of the 7-day trial period, your selected subscription activates automatically using the payment method already on file in your Shopify Admin, ensuring uninterrupted order verification and zero service downtime.
   • You can upgrade, downgrade, or cancel anytime before the 7 days elapse without incurring recurring charges.

4. Automated Transactional Notifications & Invoicing:
   • All billing receipts, trial commencement confirmations, 48-hour trial expiry reminders, and cancellation confirmations are generated and emailed natively by Shopify to your primary store owner email address.
   • Merchants maintain 100% audit visibility directly within Shopify Admin > Settings > Billing.
```

---

## 4. Merchant ROI Value Proposition (Marketing Copy for Billing Screen)

```text
Why SwiftCOD Pays For Itself On Day One:

Average Courier Return (RTO) Fee per fake parcel:    ~$4.00 (PKR 450 - ₹350)
SwiftCOD Launch Special Plan Cost:                   $5.99 / month (Includes 400 orders)

If SwiftCOD intercepts just 2 fake or impulse orders per month:
2 intercepted orders × $4.00 courier savings = $8.00 saved in courier return penalties!

Your entire monthly subscription is 100% paid for after intercepting just TWO fake orders.
The remaining 398 verifications are pure profit protection for your store.
```
