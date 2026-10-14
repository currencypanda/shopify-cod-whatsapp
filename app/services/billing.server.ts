import db from "../db.server";

export type BillingTierId = "STARTER" | "PRO" | "ENTERPRISE";

export interface BillingPlanDetails {
  id: BillingTierId;
  name: string;
  price: number; // in USD
  orderLimit: number; // -1 for unlimited
  interval: "EVERY_30_DAYS";
  description: string;
  features: string[];
}

export const BILLING_PLANS: Record<BillingTierId, BillingPlanDetails> = {
  STARTER: {
    id: "STARTER",
    name: "Starter (Free)",
    price: 0,
    orderLimit: 50,
    interval: "EVERY_30_DAYS",
    description: "Ideal for emerging stores starting out with Cash on Delivery verification.",
    features: [
      "Up to 50 COD verifications per month",
      "Automated 1-Click WhatsApp buttons",
      "Shopify Order Auto-Tagging",
      "Basic Analytics & Loss Saved tracker",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro Tier",
    price: 29.0,
    orderLimit: 1000,
    interval: "EVERY_30_DAYS",
    description: "Built for scaling e-commerce brands needing multi-market speed and order editing.",
    features: [
      "Up to 1,000 COD verifications per month",
      "Multi-Market & GCC Currency formatting",
      "Interactive WhatsApp Address & Slot Editing",
      "Auto-Restock & Inventory Recovery engine",
      "Custom Bot Tone & Multi-Language templates",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise Tier",
    price: 79.0,
    orderLimit: -1, // Unlimited
    interval: "EVERY_30_DAYS",
    description: "For high-volume merchants with dedicated throughput and custom SLAs.",
    features: [
      "Unlimited COD verifications",
      "Dedicated High-Throughput WhatsApp Routes",
      "Custom Auto-Tagging & Webhook Triggers",
      "Interactive Delivery Slot & Location Picker",
      "24/7 Dedicated Support & Custom SLA",
    ],
  },
};

const APP_SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
    ) {
      userErrors {
        field
        message
      }
      confirmationUrl
      appSubscription {
        id
        name
        status
        test
      }
    }
  }
`;

const CURRENT_APP_INSTALLATION_QUERY = `#graphql
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
  planId: "PRO" | "ENTERPRISE";
  returnUrl: string;
  isTest?: boolean;
}

/**
 * Initiates a Shopify Recurring Application Charge using GraphQL appSubscriptionCreate.
 * Supports test mode for development stores and non-production testing.
 */
export async function createAppSubscription({
  admin,
  shop,
  planId,
  returnUrl,
  isTest = true,
}: CreateSubscriptionInput): Promise<{
  confirmationUrl?: string;
  subscriptionId?: string;
  errors?: string[];
}> {
  const plan = BILLING_PLANS[planId];
  if (!plan) {
    return { errors: [`Unknown billing plan ${planId}`] };
  }

  const response = await admin.graphql(APP_SUBSCRIPTION_CREATE_MUTATION, {
    variables: {
      name: `SwiftCOD - ${plan.name}`,
      returnUrl,
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
          name: string;
          status: string;
          test: boolean;
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
  await db.shopConfig.update({
    where: { shop },
    data: { subscriptionTier: planId },
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

  const tier = (config?.subscriptionTier as BillingTierId) || "STARTER";
  return BILLING_PLANS[tier] ? tier : "STARTER";
}

/**
 * Subscription Quota Validation Middleware.
 * Enforces usage limits (e.g. 50 orders/month for Starter plan) before dispatching WhatsApp.
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
