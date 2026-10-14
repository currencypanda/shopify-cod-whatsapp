import type { ActionFunctionArgs } from "@remix-run/node";
import { Prisma, VerificationStatus } from "@prisma/client";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import {
  DEFAULT_COUNTRY_CODE,
  formatPhoneNumber,
  sendCodVerificationMessage,
  sendRichCodVerificationMessage,
} from "../services/whatsapp.server";
import {
  resolveOrderContext,
  type LineItemSummary,
  type SupportedLocale,
} from "../services/localization.server";
import { checkSubscriptionQuota } from "../services/billing.server";

/**
 * ORDERS_CREATE webhook — subscribed in shopify.app.toml as
 * `/webhooks/app/orders/create`.
 *
 * Flow: authenticate (HMAC) -> detect COD -> persist VerificationOrder ->
 * fire-and-forget WhatsApp message -> respond 200 immediately.
 */

// ---------------------------------------------------------------------------
// Payload typing (only the fields we use)
// ---------------------------------------------------------------------------

interface OrderAddress {
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  phone?: string | null;
  country_code?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
}

export interface OrderCreatePayload {
  id: number | string;
  admin_graphql_api_id?: string | null;
  name?: string | null;
  order_number?: number | null;
  total_price?: string | null;
  currency?: string | null;
  presentment_currency?: string | null;
  financial_status?: string | null;
  gateway?: string | null;
  payment_gateway_names?: string[] | null;
  phone?: string | null;
  customer_locale?: string | null;
  customer?: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    locale?: string | null;
  } | null;
  shipping_address?: OrderAddress | null;
  billing_address?: OrderAddress | null;
  line_items?: Array<{
    id?: number | string;
    title?: string;
    quantity?: number;
    price?: string;
    variant_title?: string | null;
    image?: { src?: string } | null;
  }> | null;
}

export function isOrderCreatePayload(value: unknown): value is OrderCreatePayload {
  if (typeof value !== "object" || value === null) return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === "number" || typeof id === "string";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const COD_GATEWAY_PATTERNS: RegExp[] = [
  /cash\s*on\s*delivery/i,
  /cash_on_delivery/i,
  /\bcod\b/i,
  /\bmanual\b/i,
];

/** Financial statuses for which a COD order is unpaid and requires verification. */
export const UNPAID_FINANCIAL_STATUSES = new Set(["pending", "partially_paid"]);

export function isCashOnDelivery(order: OrderCreatePayload): boolean {
  const gateways = [
    ...(order.payment_gateway_names ?? []),
    ...(order.gateway ? [order.gateway] : []),
  ];
  const gatewayIsCod = gateways.some((gateway) =>
    COD_GATEWAY_PATTERNS.some((pattern) => pattern.test(gateway)),
  );
  if (!gatewayIsCod) return false;

  // Already-paid / refunded / authorized / voided orders don't need verification.
  const status = order.financial_status?.toLowerCase();
  return !status || UNPAID_FINANCIAL_STATUSES.has(status);
}

/** Dialing codes for common markets; falls back to Pakistan. */
const CALLING_CODES: Record<string, string> = {
  PK: "92",
  AE: "971",
  SA: "966",
  QA: "974",
  OM: "968",
  KW: "965",
  BH: "973",
  GB: "44",
  US: "1",
  CA: "1",
  IN: "91",
  BD: "880",
};

export function pickCustomerPhone(order: OrderCreatePayload): string | null {
  const candidates = [
    order.shipping_address?.phone,
    order.phone,
    order.customer?.phone,
    order.billing_address?.phone,
  ];
  return candidates.find((p): p is string => typeof p === "string" && p.trim() !== "") ?? null;
}

export function pickCustomerName(order: OrderCreatePayload): string | null {
  const fromParts = (first?: string | null, last?: string | null): string =>
    [first, last].filter(Boolean).join(" ").trim();

  const name =
    order.shipping_address?.name?.trim() ||
    fromParts(order.shipping_address?.first_name, order.shipping_address?.last_name) ||
    fromParts(order.customer?.first_name, order.customer?.last_name) ||
    order.billing_address?.name?.trim();
  return name || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface DispatchArgs {
  verificationId: string;
  shop: string;
  phoneNumberId: string;
  accessToken: string;
  to: string;
  orderNumber: string;
  totalAmount: string;
  currency: string;
  customerName: string | null;
  templateName?: string;
  locale?: SupportedLocale;
  items?: LineItemSummary[];
  shippingAddress?: string | null;
  productImageUrl?: string | null;
}

/** Sends the rich WhatsApp message and records the outcome. Never throws. */
async function dispatchVerificationMessage(args: DispatchArgs): Promise<void> {
  let messageId: string;
  try {
    ({ messageId } = await sendRichCodVerificationMessage({
      phoneNumberId: args.phoneNumberId,
      accessToken: args.accessToken,
      to: args.to,
      verificationId: args.verificationId,
      orderNumber: args.orderNumber,
      totalAmount: args.totalAmount,
      currency: args.currency,
      customerName: args.customerName,
      storeName: args.shop,
      templateName: args.templateName,
      locale: args.locale,
      items: args.items,
      shippingAddress: args.shippingAddress,
      productImageUrl: args.productImageUrl,
    }));
  } catch (error) {
    console.error(
      `[orders/create] WhatsApp send failed for ${args.shop} order ${args.orderNumber}: ${errorMessage(error)}`,
    );
    await db.verificationOrder
      .update({
        where: { id: args.verificationId },
        data: { status: VerificationStatus.FAILED },
      })
      .catch((dbError: unknown) =>
        console.error(
          `[orders/create] Could not mark verification ${args.verificationId} as FAILED: ${errorMessage(dbError)}`,
        ),
      );
    return;
  }

  try {
    await db.verificationOrder.update({
      where: { id: args.verificationId },
      data: { whatsappMessageId: messageId },
    });
    console.log(
      `[orders/create] Verification message ${messageId} sent for ${args.shop} order ${args.orderNumber}`,
    );
  } catch (error) {
    console.error(
      `[orders/create] Message ${messageId} sent but not saved for verification ${args.verificationId}: ${errorMessage(error)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

const ok = (): Response => new Response(null, { status: 200 });

export const action = async ({ request }: ActionFunctionArgs) => {
  // Throws a 401 Response on invalid HMAC — let it propagate.
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    console.warn(`[orders/create] Unexpected topic ${topic} for ${shop}`);
    return ok();
  }

  try {
    const order: unknown = payload;
    if (!isOrderCreatePayload(order)) {
      console.warn(`[orders/create] Malformed payload from ${shop}`);
      return ok();
    }
    if (!isCashOnDelivery(order)) return ok();

    const config = await db.shopConfig.findUnique({ where: { shop } });
    if (!config || !config.isEnabled) return ok();

    // Enforce SaaS plan limits (e.g. Starter tier 50 orders/month)
    const quota = await checkSubscriptionQuota(shop);
    if (!quota.allowed) {
      console.warn(
        `[orders/create] Verification skipped for ${shop} order ${order.name || order.id}: ${quota.reason}`,
      );
      return ok();
    }

    const shopifyOrderId = order.admin_graphql_api_id ?? `gid://shopify/Order/${order.id}`;
    const orderNumber = order.name ?? `#${order.order_number ?? order.id}`;
    const totalAmount = order.total_price ?? "0";
    const rawCurrency = order.currency ?? "PKR";
    const customerName = pickCustomerName(order);
    const rawPhone = pickCustomerPhone(order);

    const countryIso = (order.shipping_address?.country_code ?? order.billing_address?.country_code ?? "").toUpperCase();
    const countryCode = CALLING_CODES[countryIso] ?? config.defaultCountryCode ?? DEFAULT_COUNTRY_CODE;

    // Enterprise Multi-Market Context Resolution
    const customerLocale = order.customer?.locale || order.customer_locale || null;
    const resolvedContext = resolveOrderContext({
      customerPhone: rawPhone,
      customerLocale,
      shippingCountryCode: countryIso,
      totalPrice: totalAmount,
      currency: rawCurrency,
      presentmentCurrency: order.presentment_currency,
    });

    const activeLocale = resolvedContext.locale;
    const activeCurrency = resolvedContext.currency;
    const e164Phone = resolvedContext.normalizedPhone || (rawPhone ? formatPhoneNumber(rawPhone, countryCode) : null);

    const items: LineItemSummary[] = (order.line_items || []).map((li) => ({
      title: li.title || "Product",
      quantity: li.quantity || 1,
      price: li.price,
      variantTitle: li.variant_title,
    }));

    const FALLBACK_PRODUCT_IMAGE = "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";
    const productImageUrl = order.line_items?.[0]?.image?.src || FALLBACK_PRODUCT_IMAGE;
    const addressParts = [
      order.shipping_address?.address1,
      order.shipping_address?.city,
      order.shipping_address?.province,
      countryIso,
    ].filter(Boolean);
    const shippingAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

    const phoneNumberId = config.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null;
    const accessToken = config.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || null;
    const canSend = e164Phone !== null && !!phoneNumberId && !!accessToken;

    let verificationId: string;
    try {
      const record = await db.verificationOrder.create({
        data: {
          shop,
          shopifyOrderId,
          orderNumber,
          customerPhone: e164Phone ?? rawPhone ?? "",
          customerName,
          totalAmount,
          currency: activeCurrency,
          activeCurrency,
          activeLocale,
          shippingAddress,
          productImageUrl,
          status: canSend ? VerificationStatus.PENDING_VERIFICATION : VerificationStatus.FAILED,
        },
        select: { id: true },
      });
      verificationId = record.id;
    } catch (error) {
      // Shopify may deliver the same webhook more than once.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        console.log(`[orders/create] Duplicate delivery for ${shopifyOrderId}; skipping`);
        return ok();
      }
      throw error;
    }

    if (!canSend) {
      console.warn(
        `[orders/create] Verification ${verificationId} for ${shop} ${orderNumber} marked FAILED: ` +
          (e164Phone ? "WhatsApp credentials not configured" : `invalid phone "${rawPhone ?? ""}"`),
      );
      return ok();
    }

    // Fire-and-forget: do not block the webhook response on Meta's API.
    void dispatchVerificationMessage({
      verificationId,
      shop,
      phoneNumberId,
      accessToken,
      to: e164Phone,
      orderNumber,
      totalAmount,
      currency: activeCurrency,
      customerName,
      templateName: config.whatsappTemplateName,
      locale: activeLocale,
      items,
      shippingAddress,
      productImageUrl,
    });
  } catch (error) {
    // Always acknowledge so Shopify doesn't retry-storm; the error is logged for follow-up.
    console.error(`[orders/create] Failed to process webhook for ${shop}: ${errorMessage(error)}`);
  }

  return ok();
};
