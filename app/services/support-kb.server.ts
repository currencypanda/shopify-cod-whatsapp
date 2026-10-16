/**
 * Autonomous B2B Support Knowledge Base & Diagnostic Engine
 * 
 * Provides deterministic, context-grounded responses for merchant inquiries
 * regarding billing, WhatsApp verification, GraphQL restock, GPS location capture,
 * and delivery troubleshooting.
 */

import { BILLING_PLANS } from "./billing.server";

export interface StoreSupportContext {
  shop: string;
  activeTier: string;
  planName: string;
  orderLimit: number;
  monthlyUsageCount: number;
  remainingQuota: number | string;
  botTone: string;
  botLanguage: string;
  autoCancelOnCustomerCancel: boolean;
  autoExpiryHours: number;
  tags: {
    confirmed: string;
    cancelled: string;
    addressModified: string;
    hold: string;
    expired: string;
  };
  recentFailedOrder?: {
    orderNumber: string;
    customerPhone?: string | null;
    status: string;
    createdAt: string;
    failureReason?: string;
  } | null;
  wabaStatus: string;
  brandDisplayName?: string | null;
  metaBillingActive: boolean;
}

export interface SupportResponse {
  reply: string;
  category: "billing" | "restock" | "location" | "quota" | "troubleshooting" | "settings" | "general";
  suggestedFollowups?: string[];
}

/**
 * Deterministic Knowledge Base Articles
 */
export const SUPPORT_KNOWLEDGE_BASE = {
  billing: {
    title: "Billing Tiers, 7-Day Free Trial & Automated Deductions",
    content: `
### SwiftCOD Billing Architecture & Pricing Tiers

SwiftCOD operates on three transparent subscription tiers with automatic 30-day recurring cycles:

1. **Free Starter (\`$0.00\` / month - Free Forever):**
   • **Quota:** 50 verified COD orders every 30 days.
   • **Features:** Standard WhatsApp interactive buttons, basic order tagging (\`COD-Confirmed\`, \`COD-Cancelled\`), automated restock.
   • **Trial:** None required. Instant activation without a credit card.

2. **Growth Launch Deal (\`$9.99\` / month - 7-Day Risk-Free Trial):**
   • **Quota:** Up to 500 verified COD orders / month.
   • **Trial:** Exactly 7 Days Free (\`trialDays: 7\`).
   • **Features:** Multi-tone engine (Friendly, Urgent, Formal), Roman Urdu + English + Arabic localization, Dynamic Product Image thumbnails, WhatsApp native GPS Location Pin capture, Auto-cancel & Restock engine.
   • **Regular Rate:** Discounted from \`$29.00\`.

3. **Scale / Enterprise (\`$24.99\` / month - 7-Day Risk-Free Trial):**
   • **Quota:** Unlimited verifications (\`orderLimit: -1\`).
   • **Trial:** Exactly 7 Days Free (\`trialDays: 7\`).
   • **Features:** Everything in Growth + Priority webhook queues, custom courier return loss analytics, dedicated 24/7 onboarding support.
   • **Regular Rate:** Discounted from \`$79.00\`.

### How the 7-Day Trial & Automated Deductions Work:
• **Native Shopify Authorization:** When you upgrade, Shopify natively validates your payment method on file via \`appSubscriptionCreate\`.
• **Risk-Free Trial (Days 1–7):** Your card is charged **\`$0.00\`** during the first 7 days. You can test all features risk-free.
• **Automated Day 8 Rollover:** If you do not downgrade or uninstall before Day 7 expires, Shopify automatically charges your payment method on Day 8 and initiates recurring deductions every 30 days (\`EVERY_30_DAYS\`).
• **1-Click Cancellation:** You can cancel or downgrade back to the Free Starter plan anytime directly from your dashboard in 1 click.
    `.trim(),
  },

  restock: {
    title: "GraphQL Automated Cancellation & Catalog Restock",
    content: `
### How Automatic Inventory Restocking Works

When a buyer taps **[🔴 Cancel Order]** in their WhatsApp message or an order expires unattended:

1. **Atomic Shopify GraphQL Call:** SwiftCOD triggers the official Shopify Admin GraphQL mutation \`orderCancel(restock: true, reason: CUSTOMER)\`.
2. **Immediate Catalog Restock:** Shopify automatically releases the reserved items back into your active warehouse inventory with zero manual intervention.
3. **Financial Protection:** The financial status is updated to **Voided** in Shopify Admin, preventing accidental fulfillment of unwanted COD parcels.
4. **Order Tagging:** The order is instantly tagged with your configured cancellation tag (default: \`COD-Cancelled\`) so warehouse packers skip it immediately.
5. **Configurable Power Switch:** You can toggle automatic cancellation on or off anytime in your dashboard settings under **"Automatically Cancel & Restock Rejected Orders"**.
    `.trim(),
  },

  location: {
    title: "WhatsApp GPS Location Pin Drop & Timeline Notes",
    content: `
### How WhatsApp GPS Location Pin Capture Works

To eliminate delivery failures caused by vague rural or suburban addresses in emerging markets:

1. **Buyer Action:** The buyer can tap **[⚙️ Modify Order]** -> **[📍 Change Address]** or simply share their live WhatsApp GPS location pin directly in the chat.
2. **Coordinate Extraction:** SwiftCOD intercepts the inbound WhatsApp location message and decodes the latitude and longitude coordinates.
3. **Google Maps Link Generation:** The system generates a precise navigation URL:
   \`https://www.google.com/maps?q=<latitude>,<longitude>\`
4. **Shopify Admin Integration:** 
   • The Google Maps URL is permanently appended to the **Shopify Order Timeline / Notes**.
   • The order is automatically tagged with \`COD-Address-Modified\`.
5. **Courier Handover:** Your delivery riders and courier API integrations can click the Google Maps link to navigate directly to the customer's front door!
    `.trim(),
  },

  whatsappGateway: {
    title: "Zero-Config Managed SaaS WhatsApp Gateway",
    content: `
### Zero Merchant Setup & 24-Hour Service Window

• **No Meta Setup Required:** You do **not** need a Meta Business Manager account, Facebook App ID, or Cloud API tokens. SwiftCOD operates as a turnkey, managed cloud gateway.
• **1-Click Interactive Buttons:** WhatsApp delivers high-converting native quick-reply buttons:
  - 🟢 **Confirm Order:** Validates buyer intent, tags \`COD-Confirmed\`.
  - ⚙️ **Modify Order:** Opens conversational menu for Address Edit, Items Edit, and Delivery Slot selection.
  - 🔴 **Cancel Order:** Triggers immediate inventory restock and tags \`COD-Cancelled\`.
• **24-Hour Window & Template Fallbacks:** Interactive buttons run seamlessly inside Meta's 24-hour customer care window. If needed, the system automatically falls back to Meta-approved utility templates.
    `.trim(),
  },

  troubleshooting: {
    title: "Message Delivery Diagnostics & Phone Number Normalization",
    content: `
### Delivery Troubleshooting Matrix

If a WhatsApp message fails to reach a customer, it is typically caused by one of three reasons:

1. **Invalid Phone Number or Landline:**
   • SwiftCOD automatically cleans raw phone numbers into strict international **E.164** format (e.g., \`0300 1234567\` -> \`+923001234567\`) using \`libphonenumber-js\`.
   • Landlines or numbers with incorrect digits cannot receive WhatsApp messages.
2. **No Active WhatsApp Account:**
   • Meta's API verifies recipient eligibility; if the buyer has not registered WhatsApp on that mobile line, the API reports code 131026 (recipient phone not on WhatsApp).
3. **Outside 24h Interactive Window:**
   • If custom interactive buttons cannot be delivered, SwiftCOD seamlessly falls back to pre-approved notification templates.
4. **Configured Country Calling Codes:**
   • Ensure your store's **Default Country Code** (default: \`92\` for Pakistan, \`971\` for UAE, \`966\` for Saudi Arabia) matches your primary customer demographic in the settings sidebar.
    `.trim(),
  },

  metaDirectBilling: {
    title: "Meta Direct Message Billing ($0 App Markup)",
    content: `
### Meta Direct Message Billing & Conversation Charges

SwiftCOD does NOT charge per-message markup or deduct message fees from your Shopify bill. Message fees are paid directly to Meta via the payment method attached to your WhatsApp Business Manager during the 1-click connection.

• **Zero Developer Markup:** $0 app markup or transaction cuts. You only pay standard Meta wholesale rates.
• **Transparent Wholesale Rates:** Meta charges standard utility conversation rates (e.g., ~$0.006–$0.01 in South Asia, ~$0.02 in GCC).
• **24-Hour Free Window:** Customer responses and interactive conversational modifications (address changes, time slot selection) within Meta's 24-hour customer care window incur zero extra cost.
    `.trim(),
  },

  brandIdentity: {
    title: "Official Brand Identity & Sender Display",
    content: `
### 100% Native Brand Identity & Sender Display

When you connect via Meta Embedded Signup:
• **Verified Brand Display:** Your customers will see your exact official Brand Name, logo/profile photo, and verified WhatsApp badge on their phone.
• **Dedicated Sender ID:** All messages are dispatched directly from your company's own WhatsApp Business Phone Number ID.
• **Branded Templates:** All templates automatically feature your store name, product photo, and customized order details.
    `.trim(),
  },

  embeddedSignup: {
    title: "1-Click Meta Embedded Signup Guide",
    content: `
### 1-Click Meta Embedded Signup (Under 2 Minutes)

Connecting your official WhatsApp brand line requires zero manual API tokens or Cloud console setup:
1. **Step 1:** Click **[📲 Connect Official WhatsApp via Meta]** on your dashboard.
2. **Step 2:** Log in to Facebook & select your business name and WhatsApp Business Account.
3. **Step 3:** Add/confirm your Meta payment method for direct conversation billing.

Setup takes under 2 minutes with zero API keys or manual tokens needed!
    `.trim(),
  },
};

/**
 * Autonomous Copilot Resolution Engine
 * Analyzes merchant intent and combines knowledge base facts with real-time store telemetry.
 */
export function generateSupportResponse(
  rawQuery: string,
  context: StoreSupportContext
): SupportResponse {
  const query = (rawQuery || "").toLowerCase().trim();

  // 1. Quota & Current Usage Check
  if (
    query.includes("quota") ||
    query.includes("usage") ||
    query.includes("limit") ||
    query.includes("how many order") ||
    query.includes("my plan status") ||
    query.includes("check my current plan")
  ) {
    const isUnlimited = context.orderLimit === -1;
    const remainingText = isUnlimited
      ? "unlimited remaining verifications"
      : `**${context.remainingQuota} verifications remaining**`;

    const reply = `
### ⚡ Real-Time Plan & Quota Status for \`${context.shop}\`

• **Active Subscription Tier:** **${context.planName}**
• **Monthly Usage (Current Cycle):** **${context.monthlyUsageCount}** orders processed
• **Plan Limit:** ${isUnlimited ? "**Unlimited**" : `**${context.orderLimit}** orders / month`}
• **Remaining Balance:** ${remainingText}

${
  !isUnlimited && typeof context.remainingQuota === "number" && context.remainingQuota < 20
    ? `⚠️ **Heads up:** You are nearing your monthly quota limit! Consider upgrading to the **Growth Launch Deal** ($9.99/mo for 500 orders) or **Scale / Enterprise** ($24.99/mo for Unlimited) to ensure uninterrupted COD order interception.`
    : `✅ Your store is running smoothly with full verification coverage.`
}
    `.trim();

    return {
      reply,
      category: "quota",
      suggestedFollowups: [
        "Explain the 7-day trial and billing rollover",
        "How does automatic inventory restock work?",
        "What happens if I exceed my quota?",
      ],
    };
  }

  // 2A. Direct Meta Message Billing & Wholesale Rates
  if (
    query.includes("message charge") ||
    query.includes("whatsapp charge") ||
    query.includes("how do whatsapp message charges work") ||
    query.includes("per-message") ||
    query.includes("per message") ||
    query.includes("meta charge") ||
    query.includes("conversation fee") ||
    query.includes("markup")
  ) {
    const metaBillingNotice = `\n\n📌 **Your Store's Meta Billing Status:** ${
      context.metaBillingActive
        ? "✅ **Active (Direct to Business Card)**: Message fees bill directly to your business credit card on Meta with $0 SwiftCOD markup."
        : "⚠️ **Direct Billing Pending:** Link your Meta Business Account via the top dashboard banner to enable direct wholesale conversation billing."
    }`;

    return {
      reply: `${SUPPORT_KNOWLEDGE_BASE.metaDirectBilling.content}${metaBillingNotice}`,
      category: "billing",
      suggestedFollowups: [
        "How do I connect my official WhatsApp Brand Name?",
        "Check my current plan & quota status",
        "Explain the 7-day trial and billing rollover",
      ],
    };
  }

  // 2B. Official Brand Name, Sender Identity & 1-Click Embedded Signup
  if (
    query.includes("brand name") ||
    query.includes("official whatsapp") ||
    query.includes("how do i connect my official whatsapp") ||
    query.includes("embedded signup") ||
    query.includes("connect whatsapp") ||
    query.includes("sender identity") ||
    query.includes("profile picture") ||
    query.includes("profile photo") ||
    query.includes("waba")
  ) {
    const channelNotice = `\n\n📌 **Your Current WhatsApp Channel:** ${
      context.wabaStatus === "CONNECTED"
        ? `✅ **Connected:** Sending from your official brand line **${context.brandDisplayName || context.shop}** with verified sender badge.`
        : "⚠️ **Disconnected:** Operating on the managed fallback cloud gateway. Click **[📲 Connect Official WhatsApp via Meta]** in your dashboard to connect your official brand in 1 click."
    }`;

    return {
      reply: `${SUPPORT_KNOWLEDGE_BASE.brandIdentity.content}\n\n${SUPPORT_KNOWLEDGE_BASE.embeddedSignup.content}${channelNotice}`,
      category: "settings",
      suggestedFollowups: [
        "How do WhatsApp message charges work?",
        "How does automatic inventory restock work?",
        "Check my current plan & quota status",
      ],
    };
  }

  // 2C. Billing, Plans, 7-Day Trial & Deductions
  if (
    query.includes("billing") ||
    query.includes("pricing") ||
    query.includes("plan") ||
    query.includes("trial") ||
    query.includes("7-day") ||
    query.includes("charge") ||
    query.includes("cost") ||
    query.includes("rollover") ||
    query.includes("starter") ||
    query.includes("growth") ||
    query.includes("enterprise") ||
    query.includes("deduct") ||
    query.includes("subscription")
  ) {
    const currentTierNotice = `\n\n📌 **Your Store's Active Tier:** Currently on the **${context.planName}** tier.`;

    return {
      reply: `${SUPPORT_KNOWLEDGE_BASE.billing.content}${currentTierNotice}`,
      category: "billing",
      suggestedFollowups: [
        "How do WhatsApp message charges work?",
        "How do I connect my official WhatsApp Brand Name?",
        "Check my current plan & quota status",
      ],
    };
  }

  // 3. Inventory Restocking & Order Cancellation
  if (
    query.includes("restock") ||
    query.includes("cancel") ||
    query.includes("inventory") ||
    query.includes("stock") ||
    query.includes("void") ||
    query.includes("rejected")
  ) {
    const configNote = `
\n\n⚙️ **Your Store's Restock Configuration:**
• Auto-Cancel Enabled: **${context.autoCancelOnCustomerCancel ? "Yes (Active)" : "No (Disabled)"}**
• Cancellation Tag: \`${context.tags.cancelled}\`
• Auto-Expiry Window: **${context.autoExpiryHours > 0 ? `${context.autoExpiryHours} Hours` : "Disabled"}**
    `.trim();

    return {
      reply: `${SUPPORT_KNOWLEDGE_BASE.restock.content}\n\n${configNote}`,
      category: "restock",
      suggestedFollowups: [
        "How do customers drop their GPS location pin?",
        "Why did a message not deliver?",
        "Check my current plan & quota status",
      ],
    };
  }

  // 4. GPS Location Pin Drop & Address Editing
  if (
    query.includes("gps") ||
    query.includes("location") ||
    query.includes("pin") ||
    query.includes("map") ||
    query.includes("address") ||
    query.includes("coordinates")
  ) {
    const configNote = `
\n\n📍 **Your Store's Address Settings:**
• Address Modified Tag: \`${context.tags.addressModified}\`
• WhatsApp GPS Pin Dropping is **Active** across all paid and starter tiers.
    `.trim();

    return {
      reply: `${SUPPORT_KNOWLEDGE_BASE.location.content}\n\n${configNote}`,
      category: "location",
      suggestedFollowups: [
        "How does automatic inventory restock work?",
        "Why did a message not deliver?",
        "Explain the 7-day trial and billing rollover",
      ],
    };
  }

  // 5. Message Delivery Troubleshooting & Phone Formats
  if (
    query.includes("deliver") ||
    query.includes("failed") ||
    query.includes("not receiving") ||
    query.includes("not sending") ||
    query.includes("troubleshoot") ||
    query.includes("phone") ||
    query.includes("e.164") ||
    query.includes("why did") ||
    query.includes("error")
  ) {
    let recentDiagnostic = "";
    if (context.recentFailedOrder) {
      recentDiagnostic = `
\n\n🔍 **Live Store Diagnostic on Last Failed Verification:**
• **Order:** \`${context.recentFailedOrder.orderNumber}\`
• **Recipient Phone:** \`${context.recentFailedOrder.customerPhone || "Missing"}\`
• **Status:** \`${context.recentFailedOrder.status}\`
• **Probable Root Cause:** ${
        !context.recentFailedOrder.customerPhone || context.recentFailedOrder.customerPhone.length < 10
          ? "The customer entered an incomplete or invalid phone number that could not be resolved to an international mobile line."
          : "The phone number format passed validation, but the recipient does not have an active WhatsApp account or network carrier blocked the message."
      }
• **Recommended Action:** Contact the buyer via email or alternative phone to confirm their active WhatsApp number.
      `.trim();
    } else {
      recentDiagnostic = `\n\n✅ **Live Diagnostic:** Zero failed orders recorded recently for \`${context.shop}\`. All verifications are processing normally.`;
    }

    return {
      reply: `${SUPPORT_KNOWLEDGE_BASE.troubleshooting.content}${recentDiagnostic}`,
      category: "troubleshooting",
      suggestedFollowups: [
        "Check my current plan & quota status",
        "How do customers drop their GPS location pin?",
        "How does automatic inventory restock work?",
      ],
    };
  }

  // 6. Settings, Tags, Tone & Language
  if (
    query.includes("tag") ||
    query.includes("tone") ||
    query.includes("language") ||
    query.includes("urdu") ||
    query.includes("arabic") ||
    query.includes("setting")
  ) {
    const reply = `
### ⚙️ Store Configuration & Tag Management for \`${context.shop}\`

• **Configured Shopify Admin Tags:**
  - Confirmed Orders: \`${context.tags.confirmed}\`
  - Cancelled Orders: \`${context.tags.cancelled}\`
  - Address Modified: \`${context.tags.addressModified}\`
  - Orders on Hold: \`${context.tags.hold}\`
  - Expired Orders: \`${context.tags.expired}\`

• **Bot Personality Tone:** **${context.botTone.toUpperCase()}**
  - *Friendly:* Warm, pleasant emojis, conversational phrasing.
  - *Urgent:* Highlights stock expiration and prompt confirmation.
  - *Formal:* Professional, standard business notifications.

• **Language Selection:** **${context.botLanguage.toUpperCase()}**
  - Auto-detect dynamically switches to **Roman Urdu** for Pakistan (+92), Arabic for GCC, and English for international shoppers.

You can modify any of these settings at any time in the right-hand sidebar of your SwiftCOD dashboard!
    `.trim();

    return {
      reply,
      category: "settings",
      suggestedFollowups: [
        "How does automatic inventory restock work?",
        "Check my current plan & quota status",
        "Explain the 7-day trial and billing rollover",
      ],
    };
  }

  // 7. Fallback / Out-of-Scope Handler
  const fallbackReply = `
Hello! I am your **SwiftCOD 24/7 AI Support Copilot**. 

I specialize in helping you automate Cash on Delivery verification, reduce RTO losses, and manage your store's verification workflows.

I can assist you with:
• **📲 Official Brand WhatsApp:** 1-Click Meta Embedded Signup, direct wholesale billing, and verified brand display.
• **💳 Billing & Plans:** Free Starter, Growth Deal ($9.99), Enterprise ($24.99), and the 7-day trial rollover.
• **⚡ Quota Inquiries:** Check your live monthly order usage and remaining verifications.
• **🛍️ Inventory Restocking:** How cancelled orders are automatically restored via Shopify GraphQL.
• **📍 GPS Pin Capture:** How customer WhatsApp location pins are saved to your Shopify Order Notes.
• **🔧 Delivery Diagnostics:** Why a specific order message failed and how to resolve it.

Please select a quick question below or ask me anything related to your COD verification!
  `.trim();

  return {
    reply: fallbackReply,
    category: "general",
    suggestedFollowups: [
      "How do I connect my official WhatsApp Brand Name?",
      "How do WhatsApp message charges work?",
      "Check my current plan & quota status",
      "How does automatic inventory restock work?",
    ],
  };
}
