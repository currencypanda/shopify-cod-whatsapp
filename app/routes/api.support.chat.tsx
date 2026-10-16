import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { VerificationStatus } from "@prisma/client";
import { BILLING_PLANS } from "../services/billing.server";
import {
  generateSupportResponse,
  type StoreSupportContext,
} from "../services/support-kb.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json(
    {
      status: "online",
      service: "SwiftCOD 24/7 Support Copilot API",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  // 1. Enforce Authenticated Shopify Admin Session
  let session: any = null;
  try {
    const authResult = await authenticate.admin(request);
    session = authResult.session;
  } catch (authError: any) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized: Valid Shopify Admin session required.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!session || !session.shop) {
    return json(
      { error: "Unauthorized: Missing active merchant shop context." },
      { status: 401 }
    );
  }

  const shop = session.shop;

  // 2. Parse User Query Payload
  let userMessage = "";
  try {
    const body = (await request.json()) as { message?: string };
    userMessage = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return json(
      { error: "Bad Request: Expected JSON body with a 'message' field." },
      { status: 400 }
    );
  }

  if (!userMessage) {
    return json(
      { error: "Please provide a valid question or topic." },
      { status: 400 }
    );
  }

  // 3. Inspect Real-Time Store State & Telemetry
  let config = await db.shopConfig.findUnique({ where: { shop } });
  if (!config) {
    config = await db.shopConfig.create({
      data: {
        shop,
        isEnabled: true,
        subscriptionTier: "STARTER",
      },
    });
  }

  const rawTier = (config.subscriptionTier || "STARTER") as keyof typeof BILLING_PLANS;
  const plan = BILLING_PLANS[rawTier] || BILLING_PLANS.STARTER;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyUsageCount = await db.verificationOrder.count({
    where: { shop, createdAt: { gte: startOfMonth } },
  });

  const remainingQuota =
    plan.orderLimit === -1
      ? "Unlimited"
      : Math.max(0, plan.orderLimit - monthlyUsageCount);

  // Retrieve last failed verification if any
  const recentFailed = await db.verificationOrder.findFirst({
    where: { shop, status: VerificationStatus.FAILED },
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      customerPhone: true,
      status: true,
      createdAt: true,
      auditLog: true,
    },
  });

  const storeContext: StoreSupportContext = {
    shop,
    activeTier: plan.id,
    planName: plan.name,
    orderLimit: plan.orderLimit,
    monthlyUsageCount,
    remainingQuota,
    botTone: config.botTone || "friendly",
    botLanguage: config.botLanguage || "auto",
    autoCancelOnCustomerCancel: config.autoCancelOnCustomerCancel ?? true,
    autoExpiryHours: config.autoExpiryHours ?? 24,
    tags: {
      confirmed: config.autoTagConfirmed || "COD-Confirmed",
      cancelled: config.autoTagCancelled || "COD-Cancelled",
      addressModified: config.autoTagAddressModified || "COD-Address-Modified",
      hold: config.autoTagHold || "COD-Hold",
      expired: config.autoTagExpired || "COD-Expired",
    },
    recentFailedOrder: recentFailed
      ? {
          orderNumber: recentFailed.orderNumber,
          customerPhone: recentFailed.customerPhone,
          status: recentFailed.status,
          createdAt: recentFailed.createdAt.toISOString(),
          failureReason: recentFailed.auditLog || "Delivery failure recorded",
        }
      : null,
    wabaStatus: config.wabaStatus || "DISCONNECTED",
    brandDisplayName: config.brandDisplayName || null,
    metaBillingActive: config.metaBillingActive ?? false,
  };

  // 4. Autonomous Resolution
  const supportResult = generateSupportResponse(userMessage, storeContext);

  return json({
    success: true,
    reply: supportResult.reply,
    category: supportResult.category,
    suggestedFollowups: supportResult.suggestedFollowups || [],
    context: {
      shop,
      planName: plan.name,
      monthlyUsageCount,
      orderLimit: plan.orderLimit,
      remainingQuota,
      wabaStatus: config.wabaStatus || "DISCONNECTED",
      brandDisplayName: config.brandDisplayName || null,
      metaBillingActive: config.metaBillingActive ?? false,
    },
  });
};
