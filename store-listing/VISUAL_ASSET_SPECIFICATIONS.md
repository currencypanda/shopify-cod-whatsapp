# Visual Asset Specifications: SwiftCOD (Shopify App Store)

This document provides complete visual guidelines, typography, color palettes, wireframe layouts, and exact generation prompts for creating the **Shopify App Store marketing assets**.

---

## 1. Brand Guidelines & Color Palette

| Token | Hex Code | Visual Role |
| :--- | :--- | :--- |
| **Shopify Emerald** | `#008060` | Primary brand accent, trust anchors, confirmed states |
| **WhatsApp Green** | `#25D366` | Interactive call-to-action buttons, messaging badges |
| **Deep Forest (Dark)**| `#004C3F` | High-contrast headings, dark container backgrounds |
| **Surface Light** | `#F6F6F7` | Neutral Polaris background, canvas cards |
| **Warning Amber** | `#F59E0B` | Expiry warnings, pending verification states |
| **Critical Red** | `#D72C0D` | Cancel order action, RTO loss prevention badges |
| **Slate Gray** | `#6D7175` | Secondary text, captions, metadata |

### Typography:
- **Headings:** Plus Jakarta Sans or SF Pro Display (Bold / Semi-bold, -0.02em letter spacing)
- **Body / Numbers:** Inter or Shopify Polaris System Font (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`)

---

## 2. App Icon Specifications (1200 × 1200 px)

* **Dimensions:** 1200px width × 1200px height (PNG format, 32-bit with transparency or solid edge)
* **Design Philosophy:** Clean, recognizable at 32x32px in Shopify Admin, modern minimal 3D or flat gradient.
* **Visual Elements:**
  - Background: Deep emerald-to-teal diagonal gradient (`#004C3F` to `#008060`) with subtle rounded squircle corners (Shopify standard).
  - Center Glyph: A stylized white shield or delivery parcel icon merged with a glowing vibrant WhatsApp chat bubble and a sharp verification checkmark (`#25D366`).
  - Drop Shadow: Subtle soft ambient shadow beneath the glyph for depth.
* **Graphic Prompt (for AI / Figma Generator):**
  ```text
  A modern, premium app icon for a Shopify e-commerce application named SwiftCOD. Vibrant emerald green to deep teal gradient background. In the center, a sleek, minimalist white delivery parcel box seamlessly integrated with an interactive WhatsApp chat bubble containing a crisp neon green checkmark. Clean vector aesthetic, subtle soft 3D lighting, no text, premium fintech/logistics brand identity, 1200x1200 resolution.
  ```

---

## 3. Promotional Screenshot Specifications (1600 × 1000 px, Aspect Ratio 16:10)

Shopify allows up to 5 primary promotional screenshots in the App Store listing. Each screenshot must tell a crisp story with a bold headline bar at the top, a crisp interface showcase in the center, and a benefit pill at the bottom.

---

### Screenshot 1: Financial ROI & Loss-Saved Analytics Dashboard
* **Primary Headline:** *"Turn RTO Losses Into Measurable Profit"*
* **Sub-headline:** *"Track intercepted fake orders and net courier shipping cash saved in real time."*
* **Visual Layout:**
  - Top: Gradient header banner with prominent metric badge.
  - Center: Angled 2.5D mockup of the SwiftCOD Shopify Admin Dashboard (`/app`):
    - Metric Card 1: **Verified & Dispatched Orders** (e.g., `1,284` orders • `94.2%` delivery rate)
    - Metric Card 2: **Fake Orders Intercepted** (e.g., `86` orders cancelled before shipping)
    - Metric Card 3: **Courier Cash Saved** (e.g., `PKR 38,700` or `$344.00` highlighted in glowing green badge)
  - Bottom Right: Callout pill: *"Calculated using your custom store courier return cost."*
* **Generation Prompt:**
  ```text
  High-resolution product marketing screenshot for a Shopify app store listing, 1600x1000px. Header banner reading 'Turn RTO Losses Into Measurable Profit'. Showcase a crisp, modern Shopify Polaris dashboard showing three large financial analytics cards: Verified Orders, Fake Orders Intercepted, and Total Delivery Cash Saved ($344.00 Saved). Clean SaaS user interface, deep green accent badges, ultra-crisp UI rendering.
  ```

---

### Screenshot 2: Real Customer WhatsApp Interactive 1-Click Verification
* **Primary Headline:** *"1-Click WhatsApp Verification — Zero Customer Friction"*
* **Sub-headline:** *"No apps to download, no passwords, no OTP codes. Just one tap to confirm."*
* **Visual Layout:**
  - Left Side: Realistic high-resolution smartphone mockup (iPhone 16 Pro) displaying an official WhatsApp Business conversation:
    - Sender: Verified Business Name with green checkmark
    - Message Body: *"Hi Ahmed! Please confirm your Cash on Delivery order #1004 for PKR 3,500."*
    - Interactive Quick-Reply Buttons:
      - 🟢 **Confirm Order** (Highlighted with a realistic tap ripple)
      - 🔴 **Cancel Order**
  - Right Side: Comparison callout card:
    - ❌ *Old Way:* Expensive phone calls, unanswered calls, courier non-delivery fines.
    - ✅ *SwiftCOD:* 92% response rate in under 90 seconds.
* **Generation Prompt:**
  ```text
  1600x1000px marketing graphic for Shopify App Store. Left side shows a photorealistic sleek smartphone displaying a real WhatsApp chat with an interactive Cash on Delivery order verification message and two prominent quick-reply buttons: 'Confirm Order' and 'Cancel Order'. Right side has clean typography: '1-Click WhatsApp Verification — Zero Customer Friction' and a side-by-side comparison matrix. Clean studio lighting, modern tech marketing aesthetic.
  ```

---

### Screenshot 3: Real-Time Shopify Admin Order Tagging & Timeline
* **Primary Headline:** *"Instant Order Tagging for Flawless Warehouse Fulfillment"*
* **Sub-headline:** *"Fulfillment teams know exactly which parcels are verified and safe to pack."*
* **Visual Layout:**
  - Center: High-fidelity mockup of the Shopify Admin **Orders List** view.
  - Annotated Rows:
    - Order #1004: Customer Ahmed Khan • Stamped with bright green badge **`COD-Confirmed`**
    - Order #1003: Customer Sarah Malik • Stamped with red badge **`COD-Cancelled`**
    - Order #1002: Customer Ali Raza • Stamped with amber badge **`COD-Expired`**
  - Callout Arrow: Pointing to the Shopify Order timeline: *"WhatsApp order confirmed by customer via quick-reply button."*
* **Generation Prompt:**
  ```text
  Shopify app store promotional graphic, 1600x1000px. Header: 'Instant Order Tagging for Flawless Warehouse Fulfillment'. Center display of native Shopify Admin orders table with vibrant status tags: 'COD-Confirmed' in bright green, 'COD-Cancelled' in red, and 'COD-Expired' in amber. Professional callout arrows highlighting automatic fulfillment readiness. Crisp UI design.
  ```

---

### Screenshot 4: Auto-Cancellation & Restock Engine Rules
* **Primary Headline:** *"Automatically Cancel & Restock Rejected Orders"*
* **Sub-headline:** *"Never leave inventory locked in limbo. Restock cancelled items instantly."*
* **Visual Layout:**
  - Center: Split visual representation:
    - Top: Customer taps **[Cancel Order]** on WhatsApp.
    - Automation Workflow Arrow: Instant webhook trigger.
    - Bottom: Shopify Order Detail showing:
      - Order status automatically set to **Cancelled**
      - Payment status automatically updated to **Voided**
      - Inventory banner: **"+1 item restocked to Available Inventory"**
* **Generation Prompt:**
  ```text
  1600x1000px e-commerce app graphic showcasing automated inventory restocking. Top shows WhatsApp cancellation button, center shows automated workflow connection, and bottom illustrates Shopify Admin order cancellation with inventory successfully restocked badge. Clean, vibrant graphic design with emerald and white color scheme.
  ```

---

### Screenshot 5: Merchant Automation Controls & Zero-Config Setup
* **Primary Headline:** *"Plug-and-Play Simplicity. Live in Under 60 Seconds."*
* **Sub-headline:** *"Zero Meta Business Manager or developer setup required."*
* **Visual Layout:**
  - Center: Close-up of the SwiftCOD Merchant Settings Panel built in Shopify Polaris:
    - Master Switch: **Enable Automated COD Verification** [Active Toggle]
    - Sub Switch: **Automatically Cancel & Restock Rejected Orders** [Active Toggle]
    - Dropdown Selector: **Unattended Order Expiry Window** [`24 Hours` selected]
    - Number Input: **Estimated Courier Loss per Return** [`PKR 450.00` / `$5.00`]
  - Trust Badge Banner: *"Official WhatsApp Cloud API Infrastructure • 99.9% Delivery SLA"*
* **Generation Prompt:**
  ```text
  1600x1000px SaaS marketing screenshot featuring Shopify Polaris merchant settings. Clean toggles for 'Enable Automated COD Verification' and 'Auto-Cancel & Restock', dropdown for 24-hour expiry window, and loss metric input. Floating security badges for Meta Cloud API and 99.9% SLA. Professional, minimal, high-trust presentation.
  ```

---

## 4. Asset Export Checklist

- [ ] `app-icon-1200x1200.png` (Exact 1200x1200px, 72 DPI, RGB, No alpha transparency on outer edges)
- [ ] `screenshot-1-analytics-1600x1000.png`
- [ ] `screenshot-2-whatsapp-1600x1000.png`
- [ ] `screenshot-3-tagging-1600x1000.png`
- [ ] `screenshot-4-autocancel-1600x1000.png`
- [ ] `screenshot-5-settings-1600x1000.png`
