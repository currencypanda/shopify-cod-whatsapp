import db from "../db.server";

export type BillingTierId = "STARTER" | "GROWTH" | "ENTERPRISE" | "PRO";

export const PLAN_STARTER = "STARTER";
export const PLAN_GROWTH = "GROWTH";
export const PLAN_ENTERPRISE = "ENTERPRISE";

export interface BillingPlanDetails {
  id: "STARTER" | "GROWTH" | "ENTERPRISE";
  name: string;
  price: number; // in USD
  previousPrice?: number; // for UI strike-through display
  orderLimit: number; // -1 for unlimited
  interval: "EVERY_30_DAYS";
  trialDays: number;
  badge?: string;
  description: string;
  features: string[];
}

export const BILLING_PLANS: Record<"STARTER" | "GROWTH" | "ENTERPRISE" | "PRO", BillingPlanDetails> = {
  STARTER: {
    id: "STARTER",
    name: "Free Starter",
    price: 0.0,
    orderLimit: 50,
    interval: "EVERY_30_DAYS",
    trialDays: 0,
    description: "Ideal for emerging stores starting out with Cash on Delivery verification.",
    features: [
      "Up to 50 COD verifications per month",
      "Standard WhatsApp verification templates",
      "Basic order tagging (COD-Confirmed, COD-Cancelled)",
      "Single language support",
      "Instant activation, no credit card required",
    ],
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth Launch Deal",
    price: 9.99,
    previousPrice: 29.0,
    orderLimit: 500,
    interval: "EVERY_30_DAYS",
    trialDays: 7,
    badge: "Launch Offer",
    description: "High-converting multi-lingual verification and order editing for growing DTC stores.",
    features: [
      "Up to 500 COD verifications per month",
      "High-converting Roman Urdu + English + Arabic",
      "Dynamic Product Image thumbnails",
      "Multi-tone engine (friendly, formal, urgent)",
      "GPS Location Pin capture",
      "Auto-cancel & Restock engine",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Scale / Enterprise",
    price: 24.99,
    previousPrice: 79.0,
    orderLimit: -1, // Unlimited
    interval: "EVERY_30_DAYS",
    trialDays: 7,
    badge: "Best Value",
    description: "Unlimited high-velocity verification, priority webhooks, and deep ROI protection.",
    features: [
      "Unlimited COD verifications",
      "Everything in Growth included",
      "Priority webhook processing",
      "Custom return courier loss analytics",
      "Dedicated onboarding & 24/7 priority support",
    ],
  },
  // Legacy alias mapping: "PRO" maps seamlessly to GROWTH
  get PRO() {
    return this.GROWTH;
  },
};

export const APP_SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $trialDays: Int!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription {
        id
        status
        currentPeriodEnd
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

export const CURRENT_APP_INSTALLATION_QUERY = `#graphql
  query CurrentAppInstallation {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        test
        currentPeriodEnd
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

export interface CreateSubscriptionInput {
  admin: any;
  shop: string;
  planId: "GROWTH" | "ENTERPRISE" | "PRO";
  returnUrl: string;
  isTest?: boolean;
}

/**
 * Automated Deduction Lifecycle (Shopify Billing API Architecture):
 * 
 * 1. Initial Authorization:
 *    When the merchant approves the app subscription on Shopify's confirmationUrl,
 *    Shopify natively captures and validates the merchant's payment method (credit card / PayPal).
 *    No immediate charge is posted because trialDays (7) is specified.
 * 
 * 2. 7-Day Risk-Free Trial:
 *    The subscription enters "ACTIVE" status with a 7-day trial period. The merchant can
 *    verify orders, customize bot tones, and test GPS pin capture risk-free.
 * 
 * 3. Automated Rollover & Recurring Deductions:
 *    If the merchant does not uninstall the app or downgrade before Day 7 expires,
 *    Shopify automatically charges the merchant's authorized payment method on Day 8 ($9.99 or $24.99).
 *    Subsequent charges are deducted automatically every 30 days ("EVERY_30_DAYS")
 *    without requiring manual merchant re-approval or extra confirmation prompts.
 * 
 * 4. 1-Click Cancellation / Downgrade:
 *    If the merchant downgrades to the Free Starter plan or uninstalls the app prior to trial expiration,
 *    Shopify instantly halts the subscription and zero charges are incurred.
 */
export async function createAppSubscription({
  admin,
  shop,
  planId,
  returnUrl,
  isTest = process.env.NODE_ENV !== "production",
}: CreateSubscriptionInput): Promise<{
  confirmationUrl?: string;
  subscriptionId?: string;
  errors?: string[];
}> {
  const normalizedPlanId = planId === "PRO" ? "GROWTH" : planId;
  const plan = BILLING_PLANS[normalizedPlanId];
  if (!plan) {
    return { errors: [`Unknown billing plan ${planId}`] };
  }

  const response = await admin.graphql(APP_SUBSCRIPTION_CREATE_MUTATION, {
    variables: {
      name: `SwiftCOD - ${plan.name}`,
      returnUrl,
      trialDays: plan.trialDays, // 7-day risk-free trial on paid plans
      test: isTest,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: {
                amount: plan.price,
                currencyCode: "USD",
              },
              interval: plan.interval,
            },
          },
        },
      ],
    },
  });

  const json = (await response.json()) as {
    data?: {
      appSubscriptionCreate?: {
        userErrors?: Array<{ field: string[]; message: string }>;
        confirmationUrl?: string;
        appSubscription?: {
          id: string;
          status: string;
          currentPeriodEnd?: string | null;
        };
      };
    };
  };

  const userErrors = json.data?.appSubscriptionCreate?.userErrors;
  if (userErrors && userErrors.length > 0) {
    return { errors: userErrors.map((e) => e.message) };
  }

  const confirmationUrl = json.data?.appSubscriptionCreate?.confirmationUrl;
  const subscriptionId = json.data?.appSubscriptionCreate?.appSubscription?.id;

  // Persist intended subscription tier in ShopConfig
  await db.shopConfig.upsert({
    where: { shop },
    update: { subscriptionTier: normalizedPlanId },
    create: { shop, subscriptionTier: normalizedPlanId },
  }).catch((err) => {
    console.warn(`[billing] Could not pre-update shopConfig tier for ${shop}:`, err.message);
  });

  return { confirmationUrl, subscriptionId };
}

/**
 * Queries active subscriptions for the installed shop from Shopify GraphQL.
 */
export async function getActiveSubscriptions(admin: any): Promise<any[]> {
  try {
    const response = await admin.graphql(CURRENT_APP_INSTALLATION_QUERY);
    const json = (await response.json()) as {
      data?: {
        currentAppInstallation?: {
          activeSubscriptions?: any[];
        };
      };
    };
    return json.data?.currentAppInstallation?.activeSubscriptions || [];
  } catch (error: any) {
    console.warn(`[billing] Failed to query active subscriptions: ${error.message}`);
    return [];
  }
}

/**
 * Retrieves the effective billing tier for a shop from ShopConfig (with Starter fallback).
 */
export async function getShopBillingTier(shop: string): Promise<BillingTierId> {
  const config = await db.shopConfig.findUnique({
    where: { shop },
    select: { subscriptionTier: true },
  });

  const rawTier = (config?.subscriptionTier as BillingTierId) || "STARTER";
  const tier = rawTier === "PRO" ? "GROWTH" : rawTier;
  return BILLING_PLANS[tier] ? tier : "STARTER";
}

/**
 * Subscription Quota Validation Middleware.
 * Enforces usage limits (e.g. 50 orders/month for Starter, 500 for Growth) before dispatching WhatsApp.
 */
export async function checkSubscriptionQuota(shop: string): Promise<{
  allowed: boolean;
  currentUsage: number;
  limit: number;
  tier: BillingTierId;
  reason?: string;
}> {
  const tier = await getShopBillingTier(shop);
  const plan = BILLING_PLANS[tier];

  // Current calendar month usage calculation
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const currentUsage = await db.verificationOrder.count({
    where: {
      shop,
      createdAt: { gte: startOfMonth },
    },
  });

  // Unlimited tier
  if (plan.orderLimit === -1) {
    return {
      allowed: true,
      currentUsage,
      limit: plan.orderLimit,
      tier,
    };
  }

  // Quota exceeded
  if (currentUsage >= plan.orderLimit) {
    return {
      allowed: false,
      currentUsage,
      limit: plan.orderLimit,
      tier,
      reason: `Monthly verification quota of ${plan.orderLimit} orders exceeded on ${plan.name} plan (${currentUsage} used).`,
    };
  }

  return {
    allowed: true,
    currentUsage,
    limit: plan.orderLimit,
    tier,
  };
}
