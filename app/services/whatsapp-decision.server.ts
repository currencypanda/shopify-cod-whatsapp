import { createHmac, timingSafeEqual } from "node:crypto";
import { VerificationStatus } from "@prisma/client";
import db from "../db.server";
import { parseButtonId } from "./whatsapp.server";
import {
  updateOrderVerificationTag,
  cancelShopifyOrder,
} from "./shopify-orders.server";
import { unauthenticated } from "../shopify.server";

export interface MetaInboundMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  context?: { from?: string; id?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
  };
  button?: { payload?: string; text?: string };
}

export interface MetaChangeValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  messages?: MetaInboundMessage[];
}

export interface MetaWebhookBody {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{ field?: string; value?: MetaChangeValue }>;
  }>;
}

export interface ButtonReply {
  inboundMessageId: string | null;
  from: string;
  buttonId: string;
  phoneNumberId: string | null;
  contextMessageId: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Verifies Meta's `X-Hub-Signature-256: sha256=<hex>` header against the raw body. */
export function isValidSignature(rawBody: Buffer, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header.slice("sha256=".length), expected);
}

export function extractButtonReplies(body: MetaWebhookBody): ButtonReply[] {
  const replies: ButtonReply[] = [];
  if (body.object !== "whatsapp_business_account") return replies;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const phoneNumberId = change.value.metadata?.phone_number_id ?? null;

      for (const message of change.value.messages ?? []) {
        const buttonId =
          message.type === "interactive" && message.interactive?.type === "button_reply"
            ? message.interactive.button_reply?.id
            : message.type === "button"
              ? message.button?.payload
              : undefined;

        if (!buttonId || !message.from) continue;

        replies.push({
          inboundMessageId: message.id ?? null,
          from: message.from,
          buttonId,
          phoneNumberId,
          contextMessageId: message.context?.id ?? null,
        });
      }
    }
  }
  return replies;
}

export const RESPONDABLE_STATUSES: VerificationStatus[] = [
  VerificationStatus.PENDING,
  VerificationStatus.FAILED,
];

export async function handleButtonReply(reply: ButtonReply): Promise<void> {
  const parsed = parseButtonId(reply.buttonId);
  if (!parsed) {
    console.log(`[whatsapp] Ignoring unrecognised button id "${reply.buttonId}"`);
    return;
  }
  const { decision, verificationId } = parsed;

  let verification = await db.verificationOrder.findUnique({
    where: { id: verificationId },
    include: { shopConfig: true },
  });
  if (!verification) {
    verification = await db.verificationOrder.findFirst({
      where: {
        OR: [
          { shopifyOrderId: verificationId },
          { shopifyOrderId: `gid://shopify/Order/${verificationId}` },
        ],
      },
      include: { shopConfig: true },
    });
  }
  if (!verification) {
    console.warn(`[whatsapp] Verification ${verificationId} not found`);
    return;
  }

  const { shopConfig } = verification;

  // The reply must arrive on the business number configured for this shop or central SaaS platform…
  const effectivePhoneNumberId =
    shopConfig.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (
    reply.phoneNumberId &&
    effectivePhoneNumberId &&
    reply.phoneNumberId !== effectivePhoneNumberId
  ) {
    console.warn(
      `[whatsapp] Phone number id mismatch for verification ${verificationId} (got ${reply.phoneNumberId})`,
    );
    return;
  }

  // …from the customer it was sent to…
  if (digitsOnly(reply.from) !== digitsOnly(verification.customerPhone)) {
    console.warn(`[whatsapp] Sender mismatch for verification ${verificationId}`);
    return;
  }

  // …and in response to the message we sent (when both ids are known).
  if (
    reply.contextMessageId &&
    verification.whatsappMessageId &&
    reply.contextMessageId !== verification.whatsappMessageId
  ) {
    console.warn(`[whatsapp] Context message mismatch for verification ${verificationId}`);
    return;
  }

  const newStatus =
    decision === "CONFIRM" ? VerificationStatus.CONFIRMED : VerificationStatus.CANCELLED;

  // Atomic, idempotent transition: duplicate deliveries / double taps are no-ops.
  const { count } = await db.verificationOrder.updateMany({
    where: { id: verification.id, status: { in: RESPONDABLE_STATUSES } },
    data: { status: newStatus, respondedAt: new Date() },
  });
  if (count === 0) {
    console.log(
      `[whatsapp] Verification ${verificationId} already resolved (${verification.status}); ignoring ${decision}`,
    );
    return;
  }

  try {
    const tag = await updateOrderVerificationTag({
      shop: verification.shop,
      orderId: verification.shopifyOrderId,
      decision,
      confirmedTag: shopConfig.autoTagConfirmed,
      cancelledTag: shopConfig.autoTagCancelled,
    });
    console.log(
      `[whatsapp] ${verification.shop} order ${verification.orderNumber} -> ${newStatus}, tagged "${tag}"`,
    );
  } catch (error) {
    console.error(
      `[whatsapp] Order ${verification.orderNumber} is ${newStatus} but tagging failed: ${errorMessage(error)}`,
    );
  }

  // Auto-cancel order in Shopify if configured by merchant
  if (decision === "CANCEL" && shopConfig.autoCancelOnCustomerCancel) {
    try {
      const { admin } = await unauthenticated.admin(verification.shop);
      await cancelShopifyOrder(admin, verification.shopifyOrderId, "CUSTOMER", true);
      console.log(
        `[whatsapp] ${verification.shop} order ${verification.orderNumber} auto-cancelled in Shopify`,
      );
    } catch (cancelError) {
      console.error(
        `[whatsapp] Order ${verification.orderNumber} auto-cancellation failed: ${errorMessage(cancelError)}`,
      );
    }
  }
}

export async function processButtonReplies(replies: ButtonReply[]): Promise<void> {
  for (const reply of replies) {
    try {
      await handleButtonReply(reply);
    } catch (error) {
      console.error(
        `[whatsapp] Failed to process reply ${reply.inboundMessageId ?? "?"}: ${errorMessage(error)}`,
      );
    }
  }
}
