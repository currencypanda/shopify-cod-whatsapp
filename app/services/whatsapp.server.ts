/**
 * Meta WhatsApp Cloud API service.
 *
 * - Phone number normalization to strict E.164 (Pakistan-first, international-aware).
 * - Sending interactive "Confirm / Cancel" button messages for COD verification.
 */

import {
  type SupportedLocale,
  type BotTone,
  type LineItemSummary,
  I18N_DICTIONARIES,
  buildLocalizedOrderMessage,
} from "./localization.server";

export const WHATSAPP_GRAPH_API_VERSION = "v21.0";
const WHATSAPP_GRAPH_API_BASE = `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}`;
const REQUEST_TIMEOUT_MS = 10_000;

/** Default dialing code used for numbers written in national format. */
export const DEFAULT_COUNTRY_CODE = "92"; // Pakistan

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/** Country-level mobile line validation regexes (WhatsApp requires active mobile lines). */
const PK_MOBILE_REGEX = /^\+923\d{9}$/;
const AE_MOBILE_REGEX = /^\+9715\d{8}$/;
const SA_MOBILE_REGEX = /^\+9665\d{8}$/;
const IN_MOBILE_REGEX = /^\+91[6-9]\d{9}$/;
const UK_MOBILE_REGEX = /^\+447\d{9}$/;
const US_MOBILE_REGEX = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
const DE_MOBILE_REGEX = /^\+491[567]\d{7,9}$/;

// ---------------------------------------------------------------------------
// Verification decision encoding (shared with the Meta webhook route)
// ---------------------------------------------------------------------------

export type VerificationDecision = "CONFIRM" | "CANCEL";

export type VerificationActionType =
  | "CONFIRM"
  | "CANCEL"
  | "MANAGE_ORDER"
  | "EDIT_ADDRESS"
  | "EDIT_ITEMS"
  | "SELECT_TIME_SLOT"
  | "SLOT_MORNING"
  | "SLOT_EVENING";

const ACTION_ID_REGEX =
  /^(CONFIRM(?:_ORDER)?|CANCEL(?:_ORDER)?|MANAGE(?:_ORDER)?|EDIT_ADDRESS|EDIT_ITEMS|SELECT_TIME_SLOT|SLOT_MORNING|SLOT_EVENING):([A-Za-z0-9-_:\/.]{1,200})$/i;

/** Builds the action id sent to WhatsApp, e.g. `CONFIRM:<verificationId>` or `EDIT_ADDRESS:<verificationId>`. */
export function buildActionId(
  action: VerificationActionType,
  verificationId: string,
): string {
  return `${action}:${verificationId}`;
}

/** Parses an interactive action reply id. Returns `null` if not produced by this app. */
export function parseInteractiveAction(
  buttonId: string,
): { action: VerificationActionType; verificationId: string } | null {
  if (!buttonId || typeof buttonId !== "string") return null;
  const match = ACTION_ID_REGEX.exec(buttonId.trim());
  if (!match) return null;
  const [, rawAction, verificationId] = match;
  if (!verificationId) return null;

  const upper = rawAction.toUpperCase();
  let action: VerificationActionType;
  if (upper.startsWith("CONFIRM")) {
    action = "CONFIRM";
  } else if (upper.startsWith("CANCEL")) {
    action = "CANCEL";
  } else if (upper.startsWith("MANAGE")) {
    action = "MANAGE_ORDER";
  } else if (upper === "EDIT_ADDRESS") {
    action = "EDIT_ADDRESS";
  } else if (upper === "EDIT_ITEMS") {
    action = "EDIT_ITEMS";
  } else if (upper === "SELECT_TIME_SLOT") {
    action = "SELECT_TIME_SLOT";
  } else if (upper === "SLOT_MORNING") {
    action = "SLOT_MORNING";
  } else if (upper === "SLOT_EVENING") {
    action = "SLOT_EVENING";
  } else {
    return null;
  }

  return { action, verificationId };
}

/** Builds the legacy button reply id sent to WhatsApp, e.g. `CONFIRM:<verificationId>`. */
export function buildButtonId(
  decision: VerificationDecision,
  verificationId: string,
): string {
  return `${decision}:${verificationId}`;
}

/** Parses a button reply id. Returns `null` if it was not produced by this app. */
export function parseButtonId(
  buttonId: string,
): { decision: VerificationDecision; verificationId: string } | null {
  const parsed = parseInteractiveAction(buttonId);
  if (!parsed) return null;
  if (parsed.action === "CONFIRM" || parsed.action === "CANCEL") {
    return { decision: parsed.action, verificationId: parsed.verificationId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Phone number normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes a phone number to E.164 (`+<countrycode><number>`).
 *
 * Handles common Pakistani formats:
 *   0300-1234567, 03001234567, 3001234567, 923001234567,
 *   +92 300 1234567, 0092 300 1234567, +92 0300 1234567
 * and international formats across GCC (+971, +966), NA (+1), UK (+44), EU (+49), and SA (+91).
 *
 * @param phone              Raw phone number as entered by the customer.
 * @param defaultCountryCode Dialing code used for national-format numbers
 *                           (digits, with or without "+"). Defaults to "92".
 * @returns E.164 string, or `null` if the number cannot be normalized safely.
 */
export function formatPhoneNumber(
  phone: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  if (typeof phone !== "string") return null;

  const countryCode = defaultCountryCode.replace(/\D/g, "");
  if (!/^[1-9]\d{0,2}$/.test(countryCode)) {
    throw new Error(`Invalid defaultCountryCode: "${defaultCountryCode}"`);
  }

  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  let international: string;

  if (hasPlus) {
    // Already international: +<cc><number>
    international = digits;
  } else if (digits.startsWith("00")) {
    // International dialing prefix: 00<cc><number>
    international = digits.slice(2);
  } else if (digits.startsWith("0")) {
    // National format with trunk prefix: 0<number>
    international = countryCode + digits.slice(1);
  } else if (digits.startsWith(countryCode) && digits.length > 10) {
    // Country code present but "+" omitted: 923001234567
    international = digits;
  } else if (digits.length <= 10) {
    // National format without trunk prefix: 3001234567
    international = countryCode + digits;
  } else {
    // Long number with some other country code and no "+": 971501234567
    international = digits;
  }

  // Handle redundant trunk "0" after country code, e.g. "+92 0300..." or "+971 050..."
  if (
    international.startsWith(`${countryCode}0`) &&
    international.length > countryCode.length + 8
  ) {
    international = countryCode + international.slice(countryCode.length + 1);
  }

  const e164 = `+${international}`;

  if (!E164_REGEX.test(e164)) return null;

  // Country-specific mobile validations:
  if (e164.startsWith("+92")) {
    if (!PK_MOBILE_REGEX.test(e164)) return null;
  } else if (e164.startsWith("+971")) {
    if (!AE_MOBILE_REGEX.test(e164)) return null;
  } else if (e164.startsWith("+966")) {
    if (!SA_MOBILE_REGEX.test(e164)) return null;
  } else if (e164.startsWith("+91")) {
    if (!IN_MOBILE_REGEX.test(e164)) return null;
  } else if (e164.startsWith("+44")) {
    if (!UK_MOBILE_REGEX.test(e164)) return null;
  } else if (e164.startsWith("+1")) {
    if (!US_MOBILE_REGEX.test(e164)) return null;
  } else if (e164.startsWith("+49")) {
    if (!DE_MOBILE_REGEX.test(e164)) return null;
  }

  return e164;
}

// ---------------------------------------------------------------------------
// Sending messages
// ---------------------------------------------------------------------------

export interface SendCodVerificationMessageParams {
  /** WhatsApp Business phone number id (from Meta App Dashboard). */
  phoneNumberId: string;
  /** System user / permanent access token. */
  accessToken: string;
  /** Recipient phone number in E.164 (use `formatPhoneNumber`). */
  to: string;
  /** Internal VerificationOrder id, embedded in the button reply ids. */
  verificationId: string;
  /** Human readable order number, e.g. "#1001". */
  orderNumber: string;
  /** Order total as a string/number, e.g. "2499.00". */
  totalAmount: string | number;
  /** ISO currency code, e.g. "PKR". */
  currency: string;
  /** WhatsApp Template name registered & approved in Meta Business Suite. */
  templateName?: string;
  /** Template language code, defaults to "en_US" (or "en"). */
  languageCode?: string;
  customerName?: string | null;
  storeName?: string | null;
}

export interface SendMessageResult {
  messageId: string;
  waId: string | null;
}

/** Error thrown when Meta's Graph API rejects a request or is unreachable. */
export class WhatsAppApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly code: number | null = null,
    public readonly fbtraceId: string | null = null,
  ) {
    super(message);
    this.name = "WhatsAppApiError";
  }
}

interface GraphApiErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

interface GraphApiSendMessageBody {
  messaging_product?: string;
  contacts?: Array<{ input?: string; wa_id?: string }>;
  messages?: Array<{ id?: string; message_status?: string }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Low-level POST to `/{phone-number-id}/messages`. */
async function postWhatsAppMessage(
  phoneNumberId: string,
  accessToken: string,
  payload: Record<string, unknown>,
): Promise<SendMessageResult> {
  const url = `${WHATSAPP_GRAPH_API_BASE}/${encodeURIComponent(phoneNumberId)}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new WhatsAppApiError(`WhatsApp API request failed: ${reason}`, null);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON body; handled below.
  }

  if (!response.ok) {
    const err = isRecord(body) ? (body as GraphApiErrorBody).error : undefined;
    throw new WhatsAppApiError(
      err?.message ?? `WhatsApp API responded with HTTP ${response.status}`,
      response.status,
      err?.code ?? null,
      err?.fbtrace_id ?? null,
    );
  }

  const data = isRecord(body) ? (body as GraphApiSendMessageBody) : {};
  const messageId = data.messages?.[0]?.id;
  if (!messageId) {
    throw new WhatsAppApiError(
      "WhatsApp API response did not include a message id",
      response.status,
    );
  }

  return { messageId, waId: data.contacts?.[0]?.wa_id ?? null };
}

/**
 * Sends a Meta WhatsApp Cloud API template message with quick-reply buttons
 * for Cash on Delivery (COD) verification.
 *
 * Parameters mapped to template body:
 *   {{1}}: customerName (falls back to "Customer" if null or empty)
 *   {{2}}: orderNumber
 *   {{3}}: currency + " " + totalAmount
 *
 * Quick-reply buttons:
 *   Button 0 (index "0"): payload `CONFIRM:<verificationId>`
 *   Button 1 (index "1"): payload `CANCEL:<verificationId>`
 */
export async function sendCodVerificationMessage(
  params: SendCodVerificationMessageParams,
): Promise<SendMessageResult> {
  const {
    phoneNumberId,
    accessToken,
    to,
    verificationId,
    orderNumber,
    totalAmount,
    currency,
    templateName = "cod_order_verification",
    languageCode = "en_US",
    customerName,
  } = params;

  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppApiError("Missing WhatsApp phoneNumberId or accessToken", null);
  }
  if (!E164_REGEX.test(to)) {
    throw new WhatsAppApiError(`Recipient "${to}" is not a valid E.164 number`, null);
  }

  // Meta template parameters cannot be empty strings
  const customerDisplayName = customerName?.trim() ? customerName.trim() : "Customer";
  const formattedTotal = `${currency} ${totalAmount}`;

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^\+/, ""),
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: customerDisplayName,
            },
            {
              type: "text",
              text: orderNumber,
            },
            {
              type: "text",
              text: formattedTotal,
            },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [
            {
              type: "payload",
              payload: buildButtonId("CONFIRM", verificationId),
            },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [
            {
              type: "payload",
              payload: buildButtonId("CANCEL", verificationId),
            },
          ],
        },
      ],
    },
  };

  try {
    return await postWhatsAppMessage(phoneNumberId, accessToken, payload);
  } catch (error) {
    // If custom/utility template is not approved yet in Meta, seamlessly fall back to hello_world
    if (
      error instanceof WhatsAppApiError &&
      error.code === 132001 &&
      templateName !== "hello_world"
    ) {
      console.warn(
        `[whatsapp] Template "${templateName}" not found or pending approval in Meta. Falling back to pre-approved "hello_world" template.`,
      );
      const fallbackPayload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: to.replace(/^\+/, ""),
        type: "template",
        template: {
          name: "hello_world",
          language: { code: "en_US" },
        },
      };
      return await postWhatsAppMessage(phoneNumberId, accessToken, fallbackPayload);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Rich interactive & multi-market dispatch
// ---------------------------------------------------------------------------

export interface SendWhatsAppTextMessageParams {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}

export interface InteractiveButtonOption {
  id: string;
  title: string;
}

export interface SendInteractiveButtonMessageParams {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  bodyText: string;
  buttons: InteractiveButtonOption[];
  headerImageUrl?: string | null;
  headerText?: string | null;
  footerText?: string | null;
}

export interface ListRowOption {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title: string;
  rows: ListRowOption[];
}

export interface SendInteractiveListMessageParams {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  bodyText: string;
  buttonLabel?: string;
  sections: ListSection[];
  headerText?: string | null;
  footerText?: string | null;
}

export interface SendRichCodVerificationMessageParams {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  verificationId: string;
  orderNumber: string;
  totalAmount: string | number;
  currency: string;
  locale?: SupportedLocale;
  customerName?: string | null;
  storeName?: string | null;
  items?: LineItemSummary[];
  shippingAddress?: string | null;
  productImageUrl?: string | null;
  templateName?: string;
  tone?: BotTone;
}

export async function sendWhatsAppTextMessage(
  params: SendWhatsAppTextMessageParams,
): Promise<SendMessageResult> {
  const { phoneNumberId, accessToken, to, text } = params;
  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppApiError("Missing WhatsApp phoneNumberId or accessToken", null);
  }
  if (!E164_REGEX.test(to)) {
    throw new WhatsAppApiError(`Recipient "${to}" is not a valid E.164 number`, null);
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^\+/, ""),
    type: "text",
    text: { body: text },
  };

  return await postWhatsAppMessage(phoneNumberId, accessToken, payload);
}

export async function sendInteractiveButtonMessage(
  params: SendInteractiveButtonMessageParams,
): Promise<SendMessageResult> {
  const { phoneNumberId, accessToken, to, bodyText, buttons, headerImageUrl, headerText, footerText } = params;
  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppApiError("Missing WhatsApp phoneNumberId or accessToken", null);
  }
  if (!E164_REGEX.test(to)) {
    throw new WhatsAppApiError(`Recipient "${to}" is not a valid E.164 number`, null);
  }

  const interactivePayload: Record<string, unknown> = {
    type: "button",
    body: { text: bodyText },
    action: {
      buttons: buttons.slice(0, 3).map((b) => ({
        type: "reply",
        reply: {
          id: b.id,
          title: b.title.slice(0, 20),
        },
      })),
    },
  };

  if (headerImageUrl) {
    interactivePayload.header = {
      type: "image",
      image: { link: headerImageUrl },
    };
  } else if (headerText) {
    interactivePayload.header = {
      type: "text",
      text: headerText.slice(0, 60),
    };
  }

  if (footerText) {
    interactivePayload.footer = {
      text: footerText.slice(0, 60),
    };
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^\+/, ""),
    type: "interactive",
    interactive: interactivePayload,
  };

  return await postWhatsAppMessage(phoneNumberId, accessToken, payload);
}

export async function sendInteractiveListMessage(
  params: SendInteractiveListMessageParams,
): Promise<SendMessageResult> {
  const { phoneNumberId, accessToken, to, bodyText, buttonLabel = "Options", sections, headerText, footerText } = params;
  if (!phoneNumberId || !accessToken) {
    throw new WhatsAppApiError("Missing WhatsApp phoneNumberId or accessToken", null);
  }
  if (!E164_REGEX.test(to)) {
    throw new WhatsAppApiError(`Recipient "${to}" is not a valid E.164 number`, null);
  }

  const interactivePayload: Record<string, unknown> = {
    type: "list",
    body: { text: bodyText },
    action: {
      button: buttonLabel.slice(0, 20),
      sections: sections.map((sec) => ({
        title: sec.title.slice(0, 24),
        rows: sec.rows.map((row) => ({
          id: row.id,
          title: row.title.slice(0, 24),
          description: row.description ? row.description.slice(0, 72) : undefined,
        })),
      })),
    },
  };

  if (headerText) {
    interactivePayload.header = {
      type: "text",
      text: headerText.slice(0, 60),
    };
  }

  if (footerText) {
    interactivePayload.footer = {
      text: footerText.slice(0, 60),
    };
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: to.replace(/^\+/, ""),
    type: "interactive",
    interactive: interactivePayload,
  };

  return await postWhatsAppMessage(phoneNumberId, accessToken, payload);
}

export async function sendRichCodVerificationMessage(
  params: SendRichCodVerificationMessageParams,
): Promise<SendMessageResult> {
  const locale = params.locale || "en";
  const dict = I18N_DICTIONARIES[locale];
  const formattedAmount = `${params.currency} ${params.totalAmount}`;

  const messageText = buildLocalizedOrderMessage({
    locale,
    storeName: params.storeName || "SwiftCOD Store",
    orderNumber: params.orderNumber,
    customerName: params.customerName,
    items: params.items || [],
    shippingAddress: params.shippingAddress,
    formattedAmount,
    tone: params.tone,
  });

  const buttons: InteractiveButtonOption[] = [
    {
      id: buildActionId("CONFIRM", params.verificationId),
      title: dict.buttons.confirm.slice(0, 20),
    },
    {
      id: buildActionId("MANAGE_ORDER", params.verificationId),
      title: dict.buttons.manage.slice(0, 20),
    },
    {
      id: buildActionId("CANCEL", params.verificationId),
      title: dict.buttons.cancel.slice(0, 20),
    },
  ];

  try {
    return await sendInteractiveButtonMessage({
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      to: params.to,
      bodyText: messageText,
      buttons,
      headerImageUrl: params.productImageUrl,
      footerText: params.storeName || "SwiftCOD Verification",
    });
  } catch (interactiveError) {
    console.warn(
      `[whatsapp] Interactive rich dispatch notice (${(interactiveError as Error).message}), attempting template fallback...`,
    );
    return await sendCodVerificationMessage({
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      to: params.to,
      verificationId: params.verificationId,
      orderNumber: params.orderNumber,
      totalAmount: params.totalAmount,
      currency: params.currency,
      customerName: params.customerName,
      templateName: params.templateName,
      languageCode: locale === "ar" ? "ar" : locale === "es" ? "es" : "en_US",
    });
  }
}

export async function sendDeliverySlotPicker(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  verificationId: string;
  locale?: SupportedLocale;
}): Promise<SendMessageResult> {
  const locale = params.locale || "en";
  const dict = I18N_DICTIONARIES[locale];

  return await sendInteractiveButtonMessage({
    phoneNumberId: params.phoneNumberId,
    accessToken: params.accessToken,
    to: params.to,
    headerText: dict.buttons.selectSlot,
    bodyText: dict.prompts.askTimeSlot,
    buttons: [
      {
        id: buildActionId("SLOT_MORNING", params.verificationId),
        title: "🌅 Morning",
      },
      {
        id: buildActionId("SLOT_EVENING", params.verificationId),
        title: "🌆 Evening",
      },
    ],
  });
}

export async function sendManagementMenu(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  verificationId: string;
  locale?: SupportedLocale;
  storeName?: string;
}): Promise<SendMessageResult> {
  const locale = params.locale || "en";
  const dict = I18N_DICTIONARIES[locale];

  return await sendInteractiveListMessage({
    phoneNumberId: params.phoneNumberId,
    accessToken: params.accessToken,
    to: params.to,
    headerText: dict.buttons.manage,
    bodyText: dict.actionPrompt,
    buttonLabel: dict.buttons.manage,
    sections: [
      {
        title: "Order Options",
        rows: [
          {
            id: buildActionId("CONFIRM", params.verificationId),
            title: dict.buttons.confirm,
            description: "Confirm and dispatch Cash on Delivery parcel",
          },
          {
            id: buildActionId("EDIT_ADDRESS", params.verificationId),
            title: dict.buttons.editAddress,
            description: "Change shipping address or send WhatsApp GPS pin",
          },
          {
            id: buildActionId("EDIT_ITEMS", params.verificationId),
            title: dict.buttons.editItems,
            description: "Modify items or quantities",
          },
          {
            id: buildActionId("SELECT_TIME_SLOT", params.verificationId),
            title: dict.buttons.selectSlot,
            description: "Select preferred delivery window (Morning / Evening)",
          },
          {
            id: buildActionId("CANCEL", params.verificationId),
            title: dict.buttons.cancel,
            description: "Cancel order & restock items",
          },
        ],
      },
    ],
  });
}
