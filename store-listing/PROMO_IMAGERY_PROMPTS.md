# High-Converting Promotional Imagery Prompts & Layout Architecture

**Application Name:** SwiftCOD: WhatsApp Verify  
**Target Marketplace:** Shopify App Store  
**Asset Resolution:** 1600 × 1000 px (16:10 Aspect Ratio, Standard Shopify App Store Promotion format)  
**Color Palette Tokens:**
- Shopify Emerald: `#008060`
- Dark Forest: `#004C3F`
- WhatsApp Green: `#25D366`
- Danger Red: `#D72C0D`
- Amber Warning: `#F59E0B`
- Canvas Light: `#F6F6F7`
- Dark Charcoal: `#202223`

---

## Screen 1: Dashboard ROI & Financial Loss Prevention

### 1. Headline & Copy Architecture
* **Primary Header:** *"Track Courier Loss Saved & RTO Reduction in Real Time"*
* **Secondary Sub-headline:** *"Turn courier shipping losses into measurable store profit with automated delivery intelligence."*
* **Callout Pill:** `94.2% Delivery Success Rate • PKR 38,700 ($344.00) Saved`

### 2. Layout Wireframe
```
+--------------------------------------------------------------------------------+
|  [Header Banner] Track Courier Loss Saved & RTO Reduction in Real Time          |
|  [Sub-headline] Turn courier shipping losses into measurable store profit.     |
+--------------------------------------------------------------------------------+
|  +------------------------+  +------------------------+  +--------------------+|
|  | Verified Orders        |  | Fake Orders Intercepted|  | Courier Cash Saved ||
|  | 1,284                  |  | 86                     |  | $344.00 / PKR 38.7k||
|  | +18.4% this month      |  | Cancelled & Restocked  |  | Net Shipping Profit||
|  +------------------------+  +------------------------+  +--------------------+|
|                                                                                |
|  [Live Analytics Breakdown Graph: 94.2% Delivery vs 5.8% Intercepted Fake]     |
+--------------------------------------------------------------------------------+
```

### 3. Generative Prompt Recipe (Midjourney / Flux / DALL-E 3)
```text
Clean, modern SaaS marketing presentation graphic for a Shopify App Store listing, exact dimensions 1600x1000 pixels. Top bold typography: "Track Courier Loss Saved & RTO Reduction in Real Time". Central focus is a 2.5D perspective render of the SwiftCOD Shopify Polaris merchant analytics dashboard showing three large metric cards: Verified & Dispatched Orders (1,284), Fake Orders Intercepted (86), and Total Courier Cash Saved ($344.00 Saved in vibrant emerald green badge). Realistic web interface, clean typography, soft drop shadows, sleek tech presentation aesthetic, studio lighting.
```

---

## Screen 2: Interactive WhatsApp UI & 1-Click Verification

### 1. Headline & Copy Architecture
* **Primary Header:** *"Interactive [Confirm] & [Cancel] Buttons Inside WhatsApp"*
* **Secondary Sub-headline:** *"Zero customer friction. No passwords, no login, no typing — verify with a single tap."*
* **Callout Pill:** `92% Customer Response Rate in Under 90 Seconds`

### 2. Layout Wireframe
```
+--------------------------------------------------------------------------------+
|  [Header Banner] Interactive [Confirm] & [Cancel] Buttons Inside WhatsApp      |
|  [Sub-headline] Zero customer friction. Verify orders with a single tap.       |
+--------------------------------------------------------------------------------+
|  +--------------------------------+   +---------------------------------------+|
|  | [Smartphone Frame - WhatsApp]  |   | [Feature Highlights Column]           ||
|  | Official Store Checkmark       |   | • 1-Tap Quick-Reply Confirmation      ||
|  | "Hi Ahmed! Confirm COD #1004"  |   | • Instant order validation            ||
|  | Amount: PKR 3,500 ($12.50)     |   | • Filters fake & wrong phone numbers  ||
|  | [🟢 Confirm Order Button]      |   | • Drastically reduces RTO refusals    ||
|  | [🔴 Cancel Order Button]       |   | • Official Meta Cloud API Transit     ||
|  +--------------------------------+   +---------------------------------------+|
+--------------------------------------------------------------------------------+
```

### 3. Generative Prompt Recipe
```text
Promotional e-commerce app screenshot for Shopify App Store, 1600x1000px. Bold header: "Interactive [Confirm] & [Cancel] Buttons Inside WhatsApp". Left side features an ultra-detailed smartphone mockup displaying an official WhatsApp Business verified chat with an order summary card (Order #1004, PKR 3,500) and two interactive native quick-reply buttons: high-contrast green "Confirm Order" and red "Cancel Order". Right side presents sleek bullet points highlighting 92% response rate in under 90 seconds. Clean minimalist aesthetic, emerald and slate gray tones.
```

---

## Screen 3: Shopify Admin Tagging & Real-Time Fulfillment

### 1. Headline & Copy Architecture
* **Primary Header:** *"Instant Real-Time Order Tags: COD-Confirmed & COD-Cancelled"*
* **Secondary Sub-headline:** *"Warehouse teams instantly see which parcels are verified and safe to pack."*
* **Callout Pill:** `Zero Delayed Dispatches • Automated Fulfillment Flags`

### 2. Layout Wireframe
```
+--------------------------------------------------------------------------------+
|  [Header Banner] Instant Real-Time Order Tags: COD-Confirmed & COD-Cancelled   |
|  [Sub-headline] Warehouse teams know which parcels are safe to ship.           |
+--------------------------------------------------------------------------------+
|  +---------------------------------------------------------------------------+ |
|  | Shopify Admin > Orders Table                                              | |
|  | #1004  Ahmed Khan    PKR 3,500   [TAG: COD-Confirmed]   🟢 Safe to Pack  | |
|  | #1003  Sara Malik    PKR 2,100   [TAG: COD-Cancelled]   🔴 Auto-Restocked| |
|  | #1002  Ali Hassan    PKR 4,800   [TAG: COD-Expired]     🟡 Unverified    | |
|  +---------------------------------------------------------------------------+ |
|                                                                                |
|  [Timeline Callout: Order verified by customer via WhatsApp Quick Reply]       |
+--------------------------------------------------------------------------------+
```

### 3. Generative Prompt Recipe
```text
1600x1000px marketing screenshot for Shopify app listing. Header: "Instant Real-Time Order Tags: COD-Confirmed & COD-Cancelled". Showcase an authentic Shopify Admin Orders view displaying order rows stamped with high-visibility color-coded badges: vibrant green "COD-Confirmed", red "COD-Cancelled", and amber "COD-Expired". Clean annotations and pointer lines showing timeline event: "WhatsApp response received in 42s". Crisp vector UI rendering, high contrast, professional e-commerce logistics theme.
```

---

## Screen 4: Automated Inventory Restocking

### 1. Headline & Copy Architecture
* **Primary Header:** *"Automated Restocking for Unattended or Rejected Orders"*
* **Secondary Sub-headline:** *"Instantly return rejected products to available inventory so paying buyers can purchase."*
* **Callout Pill:** `Zero Dead Stock • Automatic Order Cancellation Mutation`

### 2. Layout Wireframe
```
+--------------------------------------------------------------------------------+
|  [Header Banner] Automated Restocking for Unattended or Rejected Orders        |
|  [Sub-headline] Return cancelled items to inventory without lifting a finger.  |
+--------------------------------------------------------------------------------+
|  +----------------------+      +--------------------+      +-----------------+|
|  | 1. Customer Cancels  | ---> | 2. SwiftCOD Engine | ---> | 3. Stock Return ||
|  | Taps [Cancel Order]  |      | GraphQL Mutation   |      | +1 Restocked to ||
|  | via WhatsApp         |      | Auto-Cancel Order  |      | Inventory Live  ||
|  +----------------------+      +--------------------+      +-----------------+|
|                                                                                |
|  [Banner: Order #1003 Cancelled & Restocked • Payment Marked as Voided]        |
+--------------------------------------------------------------------------------+
```

### 3. Generative Prompt Recipe
```text
1600x1000px promotional graphic for Shopify store listing. Header: "Automated Restocking for Unattended or Rejected Orders". Diagrammatic representation showing an automated three-stage workflow: Customer tapping Cancel Order on mobile -> SwiftCOD automation engine triggering order cancellation -> Shopify inventory instantly incrementing (+1 restocked). Clean badges, glowing connection arrows, modern SaaS product aesthetic, white and emerald color scheme.
```

---

## Screen 5: Integration Setup & Zero-Code Simplicity

### 1. Headline & Copy Architecture
* **Primary Header:** *"Zero-Code Setup — Connect Meta Cloud API in Under 2 Minutes"*
* **Secondary Sub-headline:** *"No developer required. Fully managed SaaS architecture works straight out of the box."*
* **Callout Pill:** `Plug & Play • 100% Zero-Config Merchant Experience`

### 2. Layout Wireframe
```
+--------------------------------------------------------------------------------+
|  [Header Banner] Zero-Code Setup — Connect Meta Cloud API in Under 2 Minutes   |
|  [Sub-headline] Fully managed SaaS architecture. Live in 60 seconds.           |
+--------------------------------------------------------------------------------+
|  +---------------------------------------------------------------------------+ |
|  | SwiftCOD Merchant Automation Controls (Polaris Settings)                  | |
|  | [ON]  Enable Automated COD Verification                                    | |
|  | [ON]  Auto-Cancel & Restock Rejected Orders                               | |
|  | [24h] Auto-Expiry Window for Unattended Orders                             | |
|  | [$5]  Estimated Courier Loss per Return Metric                             | |
|  +---------------------------------------------------------------------------+ |
|                                                                                |
|  [Trust Badges: Official WhatsApp Cloud API • GDPR Compliant • 99.9% Uptime]   |
+--------------------------------------------------------------------------------+
```

### 3. Generative Prompt Recipe
```text
1600x1000px high-resolution marketing image for Shopify App Store. Header: "Zero-Code Setup — Connect Meta Cloud API in Under 2 Minutes". Center shows the minimalist SwiftCOD settings interface with clean toggles: "Enable Automated COD Verification", "Auto-Cancel & Restock", and a 24-hour expiry threshold dropdown. Bottom features trust badges for Meta WhatsApp Cloud API, GDPR Compliance, and 99.9% Uptime. Sophisticated gradient backdrop, ultra-clean modern typography.
```
