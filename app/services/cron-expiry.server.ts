import { VerificationStatus } from "@prisma/client";
import db from "../db.server";
import { unauthenticated } from "../shopify.server";
import { tagOrderExpired } from "./shopify-orders.server";

export async function processExpiredOrders() {
  const pendingOrders = await db.verificationOrder.findMany({
    where: {
      status: VerificationStatus.PENDING,
    },
    include: {
      shopConfig: true,
    },
    take: 200,
  });

  const now = Date.now();
  const results: Array<{ id: string; orderNumber: string; shop: string; status: string }> = [];

  for (const order of pendingOrders) {
    const expiryHours = order.shopConfig?.autoExpiryHours ?? 24;
    const expiryThresholdMs = expiryHours * 60 * 60 * 1000;
    const orderAgeMs = now - new Date(order.createdAt).getTime();

    if (orderAgeMs < expiryThresholdMs) {
      continue;
    }

    // Atomic status transition from PENDING to EXPIRED
    const { count } = await db.verificationOrder.updateMany({
      where: {
        id: order.id,
        status: VerificationStatus.PENDING,
      },
      data: {
        status: VerificationStatus.EXPIRED,
      },
    });

    if (count === 0) {
      // Order was resolved concurrently
      continue;
    }

    results.push({
      id: order.id,
      orderNumber: order.orderNumber,
      shop: order.shop,
      status: "EXPIRED",
    });

    // Tag order in Shopify via offline session
    try {
      const { admin } = await unauthenticated.admin(order.shop);
      const tag = order.shopConfig?.autoTagExpired || "COD-Expired";
      await tagOrderExpired(admin, order.shopifyOrderId, tag);
      console.log(
        `[cron/expire] Order ${order.orderNumber} expired after ${expiryHours}h; tagged "${tag}"`,
      );
    } catch (tagError) {
      console.error(
        `[cron/expire] Failed to tag expired order ${order.orderNumber} in Shopify:`,
        tagError,
      );
    }
  }

  return {
    success: true,
    checkedPendingCount: pendingOrders.length,
    expiredCount: results.length,
    expiredOrders: results,
  };
}
