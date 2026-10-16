import { createHmac, timingSafeEqual } from "node:crypto";
import { VerificationStatus } from "@prisma/client";
import db from "../db.server";
import {
  parseInteractiveAction,
  parseButtonId,
  buildActionId,
  sendWhatsAppTextMessage,
  sendInteractiveButtonMessage,
  sendManagementMenu,
  sendDeliverySlotPicker,
  type VerificationActionType,
  type VerificationDecision,
} from "./whatsapp.server";
import {
  addOrderTags,
  updateOrderVerificationTag,
  cancelShopifyOrder,
  updateOrderShippingAddress,
  updateOrderDeliverySlot,
  appendOrderVerificationNote,
} from "./shopify-orders.server";
import { unauthenticated } from "../shopify.server";
import {
  type SupportedLocale,
  I18N_DICTIONARIES,
} from "./localization.server";

export interface MetaInboundMessage {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  context?: { from?: string; id?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  button?: { payload?: string; text?: string };
  text?: { body?: string };
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };
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

export type InboundMessageType = "button_reply" | "list_reply" | "text" | "location" | "unknown";

export interface UnifiedInboundMessage {
  inboundMessageId: string | null;
  from: string;
  phoneNumberId: string | null;
  contextMessageId: string | null;
  type: InboundMessageType;
  actionId?: string;
  textBody?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
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

function appendAudit(existing: string | null | undefined, message: string): string {
  const entry = `[${new Date().toISOString()}] ${message}`;
  if (!existing) return entry;
  return `${existing}\n${entry}`;
}

/** Verifies Meta's `X-Hub-Signature-256: sha256=<hex>` header against the raw body. */
export function isValidSignature(rawBody: Buffer, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(header.slice("sha256=".length), expected);
}

export const RESPONDABLE_STATUSES: VerificationStatus[] = [
  VerificationStatus.PENDING,
  VerificationStatus.PENDING_VERIFICATION,
  VerificationStatus.AWAITING_ADDRESS_INPUT,
  VerificationStatus.AWAITING_ITEM_MODIFICATION,
  VerificationStatus.AWAITING_SLOT_SELECTION,
  VerificationStatus.FAILED,
];

/**
 * Extracts legacy ButtonReply structures (maintained for backward compatibility).
 */
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
            : message.type === "interactive" && message.interactive?.type === "list_reply"
              ? message.interactive.list_reply?.id
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

/**
 * Extracts unified inbound messages: interactive replies, text messages, and location pins.
 */
export function extractInboundMessages(body: MetaWebhookBody): UnifiedInboundMessage[] {
  const list: UnifiedInboundMessage[] = [];
  if (body.object !== "whatsapp_business_account") return list;

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const phoneNumberId = change.value.metadata?.phone_number_id ?? null;

      for (const message of change.value.messages ?? []) {
        if (!message.from) continue;

        if (message.type === "interactive") {
          const isButton = message.interactive?.type === "button_reply";
          const isList = message.interactive?.type === "list_reply";
          const actionId = isButton
            ? message.interactive?.button_reply?.id
            : isList
              ? message.interactive?.list_reply?.id
              : undefined;

          if (actionId) {
            list.push({
              inboundMessageId: message.id ?? null,
              from: message.from,
              phoneNumberId,
              contextMessageId: message.context?.id ?? null,
              type: isButton ? "button_reply" : "list_reply",
              actionId,
            });
          }
        } else if (message.type === "button" && message.button?.payload) {
          list.push({
            inboundMessageId: message.id ?? null,
            from: message.from,
            phoneNumberId,
            contextMessageId: message.context?.id ?? null,
            type: "button_reply",
            actionId: message.button.payload,
          });
        } else if (message.type === "text" && message.text?.body) {
          list.push({
            inboundMessageId: message.id ?? null,
            from: message.from,
            phoneNumberId,
            contextMessageId: message.context?.id ?? null,
            type: "text",
            textBody: message.text.body.trim(),
          });
        } else if (message.type === "location" && typeof message.location?.latitude === "number" && typeof message.location?.longitude === "number") {
          list.push({
            inboundMessageId: message.id ?? null,
            from: message.from,
            phoneNumberId,
            contextMessageId: message.context?.id ?? null,
            type: "location",
            location: {
              latitude: message.location.latitude,
              longitude: message.location.longitude,
              name: message.location.name,
              address: message.location.address,
            },
          });
        }
      }
    }
  }
  return list;
}

/**
 * Enterprise Conversational State Machine for WhatsApp Inbound Events.
 */
export async function handleUnifiedInboundMessage(message: UnifiedInboundMessage): Promise<void> {
  // -------------------------------------------------------------------------
  // Case A: Interactive Action Selection (Button or List reply)
  // -------------------------------------------------------------------------
  if (message.actionId) {
    const parsed = parseInteractiveAction(message.actionId);
    if (!parsed) {
      console.log(`[whatsapp] Ignoring unrecognised action id "${message.actionId}"`);
      return;
    }
    const { action, verificationId } = parsed;

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
    const locale = (verification.activeLocale || "en") as SupportedLocale;
    const dict = I18N_DICTIONARIES[locale] || I18N_DICTIONARIES.en;
    const phoneNumberId =
      (shopConfig.wabaStatus === "CONNECTED" ? shopConfig.phoneNumberId : null) ||
      shopConfig.whatsappPhoneNumberId ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      null;
    const accessToken =
      (shopConfig.wabaStatus === "CONNECTED" ? shopConfig.metaAccessToken : null) ||
      shopConfig.whatsappAccessToken ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      null;

    let admin: any = null;
    let session: any = null;
    try {
      ({ admin, session } = await unauthenticated.admin(verification.shop));
    } catch (err: any) {
      console.warn(`[whatsapp] Failed to obtain offline admin for ${verification.shop}: ${err.message}`);
    }

    // 1. Confirm Order
    if (action === "CONFIRM") {
      const { count } = await db.verificationOrder.updateMany({
        where: { id: verification.id, status: { in: RESPONDABLE_STATUSES } },
        data: {
          status: VerificationStatus.CONFIRMED,
          respondedAt: new Date(),
          auditLog: appendAudit(verification.auditLog, "Buyer confirmed order via WhatsApp"),
        },
      });
      if (count === 0) {
        console.log(`[whatsapp] Verification ${verification.id} already resolved; ignoring CONFIRM`);
        return;
      }

      if (admin) {
        try {
          const tag = await updateOrderVerificationTag({
            shop: verification.shop,
            orderId: verification.shopifyOrderId,
            decision: "CONFIRM",
            confirmedTag: shopConfig.autoTagConfirmed,
            cancelledTag: shopConfig.autoTagCancelled,
          });
          console.log(`[whatsapp] ${verification.shop} order ${verification.orderNumber} -> CONFIRMED, tagged "${tag}"`);
        } catch (tagErr: any) {
          console.error(`[shopify-orders] Tagging failed on confirm: ${tagErr.message}`);
        }
      }

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendWhatsAppTextMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            text: dict.prompts.orderConfirmed(verification.orderNumber),
          });
        } catch (msgErr: any) {
          console.warn(`[whatsapp] Failed to send confirmation text: ${msgErr.message}`);
        }
      }
      return;
    }

    // 2. Cancel Order
    if (action === "CANCEL") {
      const { count } = await db.verificationOrder.updateMany({
        where: { id: verification.id, status: { in: RESPONDABLE_STATUSES } },
        data: {
          status: VerificationStatus.CANCELLED,
          respondedAt: new Date(),
          auditLog: appendAudit(verification.auditLog, "Buyer cancelled order via WhatsApp (restock: true)"),
        },
      });
      if (count === 0) {
        console.log(`[whatsapp] Verification ${verification.id} already resolved; ignoring CANCEL`);
        return;
      }

      if (admin) {
        try {
          await updateOrderVerificationTag({
            shop: verification.shop,
            orderId: verification.shopifyOrderId,
            decision: "CANCEL",
            confirmedTag: shopConfig.autoTagConfirmed,
            cancelledTag: shopConfig.autoTagCancelled,
          });
          if (shopConfig.autoCancelOnCustomerCancel) {
            await cancelShopifyOrder(
              admin,
              verification.shopifyOrderId,
              "CUSTOMER",
              true,
              verification.shop,
              session?.accessToken,
            );
            console.log(`[whatsapp] ${verification.shop} order ${verification.orderNumber} auto-cancelled in Shopify`);
          }
        } catch (err: any) {
          console.error(`[shopify-orders] Cancel flow error: ${err.message}`);
        }
      }

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendWhatsAppTextMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            text: dict.prompts.orderCancelled(verification.orderNumber),
          });
        } catch (msgErr: any) {
          console.warn(`[whatsapp] Failed to send cancel text: ${msgErr.message}`);
        }
      }
      return;
    }

    // 3. Manage Order Menu
    if (action === "MANAGE_ORDER") {
      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendManagementMenu({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            verificationId: verification.id,
            locale,
            storeName: verification.shop,
          });
        } catch (menuErr: any) {
          console.warn(`[whatsapp] Failed to send management menu: ${menuErr.message}`);
        }
      }
      return;
    }

    // 4. Request Edit Address
    if (action === "EDIT_ADDRESS") {
      await db.verificationOrder.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.AWAITING_ADDRESS_INPUT,
          auditLog: appendAudit(verification.auditLog, "Buyer selected: Change Address"),
        },
      });

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendWhatsAppTextMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            text: dict.prompts.askAddress,
          });
        } catch (err: any) {
          console.warn(`[whatsapp] Failed to send address prompt: ${err.message}`);
        }
      }
      return;
    }

    // 5. Request Edit Items
    if (action === "EDIT_ITEMS") {
      await db.verificationOrder.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.AWAITING_ITEM_MODIFICATION,
          auditLog: appendAudit(verification.auditLog, "Buyer selected: Modify Items"),
        },
      });

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendWhatsAppTextMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            text: dict.prompts.askItemEdit,
          });
        } catch (err: any) {
          console.warn(`[whatsapp] Failed to send item edit prompt: ${err.message}`);
        }
      }
      return;
    }

    // 6. Request Time Slot Selection
    if (action === "SELECT_TIME_SLOT") {
      await db.verificationOrder.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.AWAITING_SLOT_SELECTION,
          auditLog: appendAudit(verification.auditLog, "Buyer selected: Pick Delivery Slot"),
        },
      });

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendDeliverySlotPicker({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            verificationId: verification.id,
            locale,
          });
        } catch (err: any) {
          console.warn(`[whatsapp] Failed to send slot picker: ${err.message}`);
        }
      }
      return;
    }

    // 7. Time Slot Chosen (Morning or Evening)
    if (action === "SLOT_MORNING" || action === "SLOT_EVENING") {
      const slotText = action === "SLOT_MORNING" ? dict.timeSlots.morning : dict.timeSlots.evening;

      await db.verificationOrder.update({
        where: { id: verification.id },
        data: {
          selectedTimeSlot: slotText,
          status: VerificationStatus.PENDING_VERIFICATION,
          auditLog: appendAudit(verification.auditLog, `Delivery slot preference recorded: ${slotText}`),
        },
      });

      if (admin) {
        try {
          await updateOrderDeliverySlot(admin, verification.shopifyOrderId, slotText, verification.shop, session?.accessToken);
          await addOrderTags(admin, verification.shopifyOrderId, ["COD-Slot-Selected"]);
        } catch (slotErr: any) {
          console.error(`[shopify-orders] Delivery slot sync failed: ${slotErr.message}`);
        }
      }

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendInteractiveButtonMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            bodyText: `${dict.prompts.timeSlotConfirmed(slotText)}\n\n${dict.actionPrompt}`,
            buttons: [
              {
                id: buildActionId("CONFIRM", verification.id),
                title: dict.buttons.confirm.slice(0, 20),
              },
              {
                id: buildActionId("CANCEL", verification.id),
                title: dict.buttons.cancel.slice(0, 20),
              },
            ],
          });
        } catch (msgErr: any) {
          console.warn(`[whatsapp] Failed to send slot confirmation message: ${msgErr.message}`);
        }
      }
      return;
    }
  }

  // -------------------------------------------------------------------------
  // Case B: Inbound Text Message from Customer
  // -------------------------------------------------------------------------
  if (message.type === "text" && message.textBody) {
    const rawDigits = digitsOnly(message.from);
    const verification = await db.verificationOrder.findFirst({
      where: {
        customerPhone: { contains: rawDigits.slice(-9) },
        status: { in: RESPONDABLE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      include: { shopConfig: true },
    });

    if (!verification) {
      console.log(`[whatsapp] No active verification awaiting input for sender ${message.from}`);
      return;
    }

    const { shopConfig } = verification;
    const locale = (verification.activeLocale || "en") as SupportedLocale;
    const dict = I18N_DICTIONARIES[locale] || I18N_DICTIONARIES.en;
    const phoneNumberId =
      (shopConfig.wabaStatus === "CONNECTED" ? shopConfig.phoneNumberId : null) ||
      shopConfig.whatsappPhoneNumberId ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      null;
    const accessToken =
      (shopConfig.wabaStatus === "CONNECTED" ? shopConfig.metaAccessToken : null) ||
      shopConfig.whatsappAccessToken ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      null;

    let admin: any = null;
    let session: any = null;
    try {
      ({ admin, session } = await unauthenticated.admin(verification.shop));
    } catch (err: any) {
      console.warn(`[whatsapp] Admin session error: ${err.message}`);
    }

    // B1: Address text input
    if (verification.status === VerificationStatus.AWAITING_ADDRESS_INPUT) {
      const newAddress = message.textBody;

      await db.verificationOrder.update({
        where: { id: verification.id },
        data: {
          shippingAddress: newAddress,
          status: VerificationStatus.PENDING_VERIFICATION,
          auditLog: appendAudit(verification.auditLog, `Shipping address updated: ${newAddress}`),
        },
      });

      if (admin) {
        try {
          await updateOrderShippingAddress(
            admin,
            verification.shopifyOrderId,
            { address1: newAddress },
            verification.shop,
            session?.accessToken,
          );
          await addOrderTags(admin, verification.shopifyOrderId, ["COD-Address-Modified"]);
        } catch (addrErr: any) {
          console.error(`[shopify-orders] Address update failed: ${addrErr.message}`);
        }
      }

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendInteractiveButtonMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            bodyText: dict.prompts.addressUpdated(newAddress),
            buttons: [
              {
                id: buildActionId("CONFIRM", verification.id),
                title: dict.buttons.confirm.slice(0, 20),
              },
              {
                id: buildActionId("CANCEL", verification.id),
                title: dict.buttons.cancel.slice(0, 20),
              },
            ],
          });
        } catch (msgErr: any) {
          console.warn(`[whatsapp] Failed to send address update preview: ${msgErr.message}`);
        }
      }
      return;
    }

    // B2: Item modification text input
    if (verification.status === VerificationStatus.AWAITING_ITEM_MODIFICATION) {
      const itemDetails = message.textBody;

      await db.verificationOrder.update({
        where: { id: verification.id },
        data: {
          status: VerificationStatus.PENDING_VERIFICATION,
          auditLog: appendAudit(verification.auditLog, `Item modification requested: ${itemDetails}`),
        },
      });

      if (admin) {
        try {
          await appendOrderVerificationNote(
            admin,
            verification.shopifyOrderId,
            `[Customer Requested Item Modification: ${itemDetails}]`,
          );
          await addOrderTags(admin, verification.shopifyOrderId, ["COD-Item-Modified"]);
        } catch (itemErr: any) {
          console.error(`[shopify-orders] Item note append failed: ${itemErr.message}`);
        }
      }

      if (phoneNumberId && accessToken && verification.customerPhone) {
        try {
          await sendInteractiveButtonMessage({
            phoneNumberId,
            accessToken,
            to: verification.customerPhone,
            bodyText: dict.prompts.itemsUpdated(itemDetails),
            buttons: [
              {
                id: buildActionId("CONFIRM", verification.id),
                title: dict.buttons.confirm.slice(0, 20),
              },
              {
                id: buildActionId("CANCEL", verification.id),
                title: dict.buttons.cancel.slice(0, 20),
              },
            ],
          });
        } catch (msgErr: any) {
          console.warn(`[whatsapp] Failed to send item update confirmation: ${msgErr.message}`);
        }
      }
      return;
    }
  }

  // -------------------------------------------------------------------------
  // Case C: Inbound Location Pin from Customer
  // -------------------------------------------------------------------------
  if (message.type === "location" && message.location) {
    const rawDigits = digitsOnly(message.from);
    const verification = await db.verificationOrder.findFirst({
      where: {
        customerPhone: { contains: rawDigits.slice(-9) },
        status: { in: RESPONDABLE_STATUSES },
      },
      orderBy: { createdAt: "desc" },
      include: { shopConfig: true },
    });

    if (!verification) {
      console.log(`[whatsapp] No active verification for GPS pin from ${message.from}`);
      return;
    }

    const { latitude, longitude } = message.location;
    const { shopConfig } = verification;
    const locale = (verification.activeLocale || "en") as SupportedLocale;
    const dict = I18N_DICTIONARIES[locale] || I18N_DICTIONARIES.en;
    const phoneNumberId =
      (shopConfig.wabaStatus === "CONNECTED" ? shopConfig.phoneNumberId : null) ||
      shopConfig.whatsappPhoneNumberId ||
      process.env.WHATSAPP_PHONE_NUMBER_ID ||
      null;
    const accessToken =
      (shopConfig.wabaStatus === "CONNECTED" ? shopConfig.metaAccessToken : null) ||
      shopConfig.whatsappAccessToken ||
      process.env.WHATSAPP_ACCESS_TOKEN ||
      null;

    let admin: any = null;
    let session: any = null;
    try {
      ({ admin, session } = await unauthenticated.admin(verification.shop));
    } catch (err: any) {
      console.warn(`[whatsapp] Admin session error: ${err.message}`);
    }

    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

    await db.verificationOrder.update({
      where: { id: verification.id },
      data: {
        locationLat: latitude,
        locationLng: longitude,
        status: VerificationStatus.PENDING_VERIFICATION,
        auditLog: appendAudit(
          verification.auditLog,
          `GPS location pin recorded: (${latitude}, ${longitude}) -> ${googleMapsUrl}`,
        ),
      },
    });

    if (admin) {
      try {
        await appendOrderVerificationNote(
          admin,
          verification.shopifyOrderId,
          `[Customer GPS Pin: ${googleMapsUrl}]`,
        );
        await addOrderTags(admin, verification.shopifyOrderId, [
          shopConfig.autoTagAddressModified || "COD-Address-Modified",
        ]);
      } catch (locErr: any) {
        console.error(`[shopify-orders] GPS note append failed: ${locErr.message}`);
      }
    }

    if (phoneNumberId && accessToken && verification.customerPhone) {
      try {
        await sendInteractiveButtonMessage({
          phoneNumberId,
          accessToken,
          to: verification.customerPhone,
          bodyText: `${dict.prompts.locationReceived(latitude, longitude)}\n\n${dict.actionPrompt}`,
          buttons: [
            {
              id: buildActionId("CONFIRM", verification.id),
              title: dict.buttons.confirm.slice(0, 20),
            },
            {
              id: buildActionId("CANCEL", verification.id),
              title: dict.buttons.cancel.slice(0, 20),
            },
          ],
        });
      } catch (msgErr: any) {
        console.warn(`[whatsapp] Failed to send location confirmation message: ${msgErr.message}`);
      }
    }
  }
}

/** Legacy adapter for ButtonReply */
export async function handleButtonReply(reply: ButtonReply): Promise<void> {
  await handleUnifiedInboundMessage({
    inboundMessageId: reply.inboundMessageId,
    from: reply.from,
    phoneNumberId: reply.phoneNumberId,
    contextMessageId: reply.contextMessageId,
    type: "button_reply",
    actionId: reply.buttonId,
  });
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

export async function processInboundMessages(messages: UnifiedInboundMessage[]): Promise<void> {
  for (const msg of messages) {
    try {
      await handleUnifiedInboundMessage(msg);
    } catch (error) {
      console.error(
        `[whatsapp] Failed to process inbound message ${msg.inboundMessageId ?? "?"}: ${errorMessage(error)}`,
      );
    }
  }
}
