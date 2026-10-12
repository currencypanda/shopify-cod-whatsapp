import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory GDPR Compliance Webhook: SHOP_REDACT
 *
 * Triggered 48 hours after a store uninstalls the app.
 *
 * Requirements:
 * - Verify Shopify HMAC signature.
 * - Erase all stored shop data, configs, and historical verification records.
 * - Respond with HTTP 200 OK immediately.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} compliance purge request for shop: ${shop}`);

  try {
    // 1. Delete all order verification history for the shop
    const deletedOrders = await db.verificationOrder.deleteMany({
      where: { shop },
    });

    // 2. Delete shop configuration
    const deletedConfig = await db.shopConfig.deleteMany({
      where: { shop },
    });

    // 3. Delete any remaining shop sessions
    const deletedSessions = await db.session.deleteMany({
      where: { shop },
    });

    console.log(
      `[GDPR] Successfully purged all data for ${shop}: ` +
        `${deletedOrders.count} orders, ${deletedConfig.count} configs, ${deletedSessions.count} sessions removed.`,
    );

    return new Response(JSON.stringify({ status: "purged", shop }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[GDPR] Error purging data on ${topic} for ${shop}:`, error?.message || error);
    return new Response("Purge error processed", { status: 200 });
  }
};
