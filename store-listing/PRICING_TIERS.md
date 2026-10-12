# SwiftCOD: Pricing Tier Architecture & Billing Disclosures

This document details the pricing tier model, plan quotas, overage terms, and Shopify Billing API compliant disclosures for **SwiftCOD: WhatsApp Verify**.

---

## 1. Pricing Tier Summary Matrix

| Plan Tier | Price / Month | Monthly Order Quota | Extra Order Rate | Key Included Features | Target Merchant Profile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Starter (Free)** | **$0.00** | **50 Orders** | Blocked / Upgrade Prompt | 1-Click WhatsApp buttons, Basic Tags (`COD-Confirmed`), Standard Support | Stores testing COD verification or new Shopify merchants |
| **Growth** | **$19.00** | **500 Orders** | $0.04 / order | Auto-Cancel & Restock, Expiry Rules (12h/24h/48h), Financial ROI Loss Dashboard, Custom Tags | Rapidly scaling D2C brands with 200–500 monthly orders |
| **Scale / Pro** | **$49.00** | **2,000 Orders** | $0.025 / order | Everything in Growth + Multi-country routing, Priority WhatsApp Dispatch, Dedicated WhatsApp Support | High-volume merchants processing 500–2,000+ monthly orders |
| **Enterprise** | **$129.00** | **6,000 Orders** | $0.018 / order | Custom Template Branding, Dedicated Account Manager, Custom Webhook Integrations, 99.95% SLA | High-volume retail chains & enterprise flash-sale merchants |

---

## 2. Detailed Plan Specifications

### Plan 1: Starter (Free Forever)
* **Monthly Fee:** `$0.00`
* **Free Trial:** None needed (Free plan available immediately upon install)
* **Allotted Verifications:** Up to **50 verified COD orders per month**
* **Features Included:**
  * Automated WhatsApp 1-click confirmation & cancellation buttons
  * Zero-config SaaS managed messaging
  * Automated Shopify Admin tags (`COD-Confirmed`, `COD-Cancelled`)
  * International phone number formatting (E.164)
  * Standard email support
* **Quota Exhaustion Behavior:** Once 50 orders are reached in a monthly billing cycle, automated dispatches pause and the merchant is prompted to upgrade in the dashboard. Existing verified orders remain accessible.

---

### Plan 2: Growth ($19 / month)
* **Monthly Fee:** `$19.00 / month`
* **Free Trial:** 7-Day Free Trial
* **Allotted Verifications:** Up to **500 verified COD orders per month**
* **Overage Rate:** `$0.04 per additional order` (capped with merchant-defined Shopify usage limit)
* **Features Included:**
  * All Starter features
  * **Auto-Cancel & Restock Engine:** Automatically voids unconfirmed or cancelled orders and returns stock to Shopify inventory
  * **Customizable Auto-Expiry Window:** Automatically mark unattended orders as `COD-Expired` after 12, 24, or 48 hours
  * **Financial ROI & Loss-Saved Analytics:** Real-time dashboard showing exact currency saved based on courier return charges
  * **Custom Admin Tagging:** Personalize your order tags for seamless courier warehouse integration
  * Email & chat support (24-hour turnaround)

---

### Plan 3: Scale / Pro ($49 / month)
* **Monthly Fee:** `$49.00 / month`
* **Free Trial:** 7-Day Free Trial
* **Allotted Verifications:** Up to **2,000 verified COD orders per month**
* **Overage Rate:** `$0.025 per additional order`
* **Features Included:**
  * All Growth features
  * **Multi-Country Routing & Fallback:** Priority routing for GCC, South Asia, and North Africa
  * **High-Speed WhatsApp Cloud Dispatch Queue:** Instantaneous delivery during flash sales
  * **Exportable Verification Logs:** Download full CSV audit trails of customer responses and response timestamps
  * Priority WhatsApp & email support (4-hour turnaround)

---

### Plan 4: Enterprise ($129 / month)
* **Monthly Fee:** `$129.00 / month`
* **Allotted Verifications:** Up to **6,000 verified COD orders per month**
* **Overage Rate:** `$0.018 per additional order`
* **Features Included:**
  * All Scale features
  * Custom WhatsApp template name & Meta business profile association
  * Multi-store volume aggregation discount
  * Custom webhook integrations & courier ERP hooks
  * Dedicated Account Manager & 99.95% uptime SLA

---

## 3. Shopify Billing Compliance Disclosures

Shopify requires clear, transparent disclosures regarding how merchants are billed. Below is the exact text to be displayed on the in-app pricing screen and Shopify App Store listing:

```text
Billing Terms & Conditions:
• All charges are billed in USD and will appear directly on your recurring Shopify 30-day invoice.
• Plan subscriptions renew automatically every 30 days unless cancelled before the end of the current billing cycle.
• Paid plans include a 7-day risk-free trial. You will not be charged if you cancel before the trial concludes.
• You can upgrade, downgrade, or cancel anytime directly inside the app or by uninstalling SwiftCOD from your Shopify Admin.
• Overage usage (if enabled) is tracked automatically and billed against your approved monthly usage cap at the end of the 30-day cycle.
```

---

## 4. Merchant ROI Value Proposition (Marketing Copy for Billing Screen)

```text
Why SwiftCOD Pays For Itself On Day One:

Average Courier Return (RTO) Fee per fake package:  ~$4.00 (PKR 450 - ₹350)
SwiftCOD Growth Plan Cost:                         $19.00 / month

If SwiftCOD intercepts just 5 fake or impulse orders per month:
5 orders × $4.00 saved = $20.00 saved in courier losses!

Your app subscription is 100% paid for after intercepting just 5 fake orders. 
Every intercepted fake order beyond that is pure cash saved directly to your bottom line.
```
