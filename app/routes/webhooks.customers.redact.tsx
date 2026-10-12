import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory GDPR Compliance Webhook: CUSTOMERS_REDACT
 *
 * Triggered when a store owner or customer requests deletion of personal data.
 *
 * Requirements:
 * - Verify Shopify HMAC signature.
 * - Redact or purge customer personal data (phone, name) from database.
 * - Respond with HTTP 200 OK immediately.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`[GDPR] Received ${topic} compliance request for shop: ${shop}`);

  try {
    const data = payload as {
      customer?: {
        id?: number | string;
        email?: string | null;
        phone?: string | null;
      };
      orders_to_redact?: Array<number | string>;
    };

    const customerPhone = data.customer?.phone;
    const ordersToRedact = data.orders_to_redact?.map(String) || [];

    // Redact customer personal identifiable information (PII) from verification records
    const updateResult = await db.verificationOrder.updateMany({
      where: {
        shop,
        OR: [
          ...(customerPhone ? [{ customerPhone }] : []),
          ...(ordersToRedact.length > 0
            ? [
                {
                  shopifyOrderId: {
                    in: ordersToRedact.map((id) =>
                      id.startsWith("gid://") ? id : `gid://shopify/Order/${id}`,
                    ),
                  },
                },
              ]
            : []),
        ],
      },
      data: {
        customerName: "REDACTED",
        customerPhone: "REDACTED",
      },
    });

    console.log(
      `[GDPR] Redacted ${updateResult.count} customer records on ${shop} to comply with privacy request.`,
    );

    return new Response(JSON.stringify({ status: "redacted", recordsModified: updateResult.count }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[GDPR] Error processing ${topic} for ${shop}:`, error?.message || error);
    return new Response("Error processed", { status: 200 });
  }
};
