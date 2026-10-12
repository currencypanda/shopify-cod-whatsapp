import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory GDPR Compliance Webhook: CUSTOMERS_DATA_REQUEST
 *
 * Triggered when a customer requests a copy of their personal data from Shopify.
 * Shopify forwards the request to apps that store customer personal data.
 *
 * Requirements:
 * - Verify Shopify HMAC signature.
 * - Gather customer records stored by the app.
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
      orders_requested?: Array<number | string>;
    };

    const customerPhone = data.customer?.phone;
    const requestedOrderIds = data.orders_requested?.map(String) || [];

    // Query any customer verification data retained in the app
    const customerRecords = await db.verificationOrder.findMany({
      where: {
        shop,
        OR: [
          ...(customerPhone ? [{ customerPhone }] : []),
          ...(requestedOrderIds.length > 0
            ? [
                {
                  shopifyOrderId: {
                    in: requestedOrderIds.map((id) =>
                      id.startsWith("gid://") ? id : `gid://shopify/Order/${id}`,
                    ),
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        customerPhone: true,
        status: true,
        createdAt: true,
      },
    });

    console.log(
      `[GDPR] Found ${customerRecords.length} records for customer data request on ${shop}.`,
    );

    // Return 200 OK acknowledgment to Shopify
    return new Response(JSON.stringify({ status: "acknowledged", recordsFound: customerRecords.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[GDPR] Error processing ${topic} for ${shop}:`, error?.message || error);
    // Always return 200 to Shopify for compliance webhook delivery acknowledgment
    return new Response("Error processed", { status: 200 });
  }
};
