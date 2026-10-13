/**
 * Shopify order helpers built exclusively on the Admin GraphQL API.
 */
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { unauthenticated } from "../shopify.server";
import type { VerificationDecision } from "./whatsapp.server";

type AdminGraphqlClient = Pick<AdminApiContext, "graphql">;

const TAGS_ADD_MUTATION = `#graphql
  mutation AddOrderTags($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors {
        field
        message
      }
    }
  }
`;

interface TagsAddResponse {
  data?: {
    tagsAdd?: {
      userErrors: Array<{ field: string[] | null; message: string }>;
    } | null;
  };
  errors?: unknown;
}

export class ShopifyOrderTagError extends Error {
  constructor(
    message: string,
    public readonly orderId: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ShopifyOrderTagError";
  }
}

/** Converts a numeric order id (or an existing GID) to `gid://shopify/Order/<id>`. */
export function toOrderGid(orderId: string | number): string {
  const value = String(orderId).trim();
  if (value.startsWith("gid://shopify/Order/")) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/Order/${value}`;
  throw new ShopifyOrderTagError(`Invalid Shopify order id: "${value}"`, value);
}

/**
 * Adds one or more tags to an order using the `tagsAdd` mutation.
 * Requires the `write_orders` access scope.
 */
export async function addOrderTags(
  admin: AdminGraphqlClient,
  orderId: string | number,
  tags: string[],
): Promise<void> {
  const id = toOrderGid(orderId);
  const cleanTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  if (cleanTags.length === 0) return;

  let json: TagsAddResponse;
  try {
    const response = await admin.graphql(TAGS_ADD_MUTATION, {
      variables: { id, tags: cleanTags },
    });
    json = (await response.json()) as TagsAddResponse;
  } catch (error) {
    // admin.graphql throws on transport errors and top-level GraphQL errors.
    const reason = error instanceof Error ? error.message : String(error);
    throw new ShopifyOrderTagError(`tagsAdd request failed: ${reason}`, id, error);
  }

  if (json.errors) {
    throw new ShopifyOrderTagError("tagsAdd returned GraphQL errors", id, json.errors);
  }

  const payload = json.data?.tagsAdd;
  if (!payload) {
    throw new ShopifyOrderTagError("tagsAdd returned an empty payload", id, json);
  }
  if (payload.userErrors.length > 0) {
    const message = payload.userErrors.map((e) => e.message).join("; ");
    throw new ShopifyOrderTagError(`tagsAdd user errors: ${message}`, id, payload.userErrors);
  }
}

export interface UpdateOrderVerificationTagParams {
  /** Shop domain, e.g. "my-store.myshopify.com". */
  shop: string;
  /** Shopify order id (numeric or GID). */
  orderId: string | number;
  decision: VerificationDecision;
  /** Tag applied on CONFIRM. Defaults to "COD-Confirmed". */
  confirmedTag?: string;
  /** Tag applied on CANCEL. Defaults to "COD-Cancelled". */
  cancelledTag?: string;
}

/**
 * Tags a Shopify order with the customer's COD verification decision.
 *
 * Intended for contexts without a Shopify request (e.g. Meta webhooks), so it
 * loads the shop's offline session via `unauthenticated.admin`.
 */
const ORDER_UPDATE_NOTE_MUTATION = `#graphql
  mutation AppendOrderNote($input: OrderInput!) {
    orderUpdate(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

export async function appendOrderVerificationNote(
  admin: AdminGraphqlClient,
  orderId: string | number,
  noteText: string,
): Promise<void> {
  const id = toOrderGid(orderId);
  try {
    const res = await admin.graphql(ORDER_UPDATE_NOTE_MUTATION, {
      variables: {
        input: {
          id,
          note: noteText,
        },
      },
    });
    const json = (await res.json()) as any;
    if (json.data?.orderUpdate?.userErrors?.length) {
      console.warn(`[shopify-orders] orderUpdate userErrors:`, json.data.orderUpdate.userErrors);
    }
  } catch (error) {
    console.warn(`[shopify-orders] Failed to append order note to ${id}:`, error);
  }
}

export async function updateOrderVerificationTag({
  shop,
  orderId,
  decision,
  confirmedTag = "COD-Confirmed",
  cancelledTag = "COD-Cancelled",
}: UpdateOrderVerificationTagParams): Promise<string> {
  const tag = decision === "CONFIRM" ? confirmedTag : cancelledTag;

  let admin: AdminGraphqlClient;
  let session: any;
  try {
    ({ admin, session } = await unauthenticated.admin(shop));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ShopifyOrderTagError(
      `Could not load offline session for ${shop}: ${reason}`,
      String(orderId),
      error,
    );
  }

  const numericId = String(orderId).replace(/\D/g, "");
  let tagAdded = false;

  try {
    await addOrderTags(admin, orderId, [tag]);
    tagAdded = true;
  } catch (graphqlErr: any) {
    console.warn(`[shopify-orders] GraphQL tagsAdd notice (${graphqlErr.message}), trying REST fallback...`);
  }

  // REST fallback if GraphQL encounters Protected Customer Data checks on dev stores
  if (!tagAdded && session?.accessToken && numericId) {
    try {
      const getRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericId}.json?fields=id,tags,note`, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
      });
      const getData = (await getRes.json()) as any;
      const currentTags = getData?.order?.tags || "";
      const currentNote = getData?.order?.note || "";

      const tagsArray = currentTags.split(",").map((t: string) => t.trim()).filter(Boolean);
      if (!tagsArray.includes(tag)) {
        tagsArray.push(tag);
      }
      const updatedTags = tagsArray.join(", ");
      const timestamp = new Date().toISOString();
      const updatedNote = decision === "CONFIRM"
        ? (currentNote ? `${currentNote}\n[COD Verified via WhatsApp on ${timestamp}]` : `[COD Verified via WhatsApp on ${timestamp}]`)
        : currentNote;

      const putRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericId}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": session.accessToken,
        },
        body: JSON.stringify({
          order: {
            id: Number(numericId),
            tags: updatedTags,
            note: updatedNote,
          },
        }),
      });

      if (putRes.ok) {
        tagAdded = true;
        console.log(`[shopify-orders] Applied tag "${tag}" via REST fallback`);
      }
    } catch (restErr: any) {
      console.error(`[shopify-orders] REST tag fallback error:`, restErr.message);
    }
  }

  if (tagAdded && decision === "CONFIRM") {
    const timestamp = new Date().toISOString();
    await appendOrderVerificationNote(
      admin,
      orderId,
      `[COD Verified via WhatsApp on ${timestamp}]`,
    );
  }

  return tag;
}

// ---------------------------------------------------------------------------
// Order cancellation mutation & Expired tagging helper
// ---------------------------------------------------------------------------

export type OrderCancelReason =
  | "CUSTOMER"
  | "DECLINED"
  | "FRAUD"
  | "INVENTORY"
  | "OTHER"
  | "STAFF";

export class ShopifyOrderCancelError extends Error {
  constructor(
    message: string,
    public readonly orderId: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ShopifyOrderCancelError";
  }
}

const ORDER_CANCEL_MUTATION = `#graphql
  mutation OrderCancel($orderId: ID!, $reason: OrderCancelReason!, $restock: Boolean!) {
    orderCancel(orderId: $orderId, reason: $reason, restock: $restock) {
      orderCancelUserErrors {
        code
        field
        message
      }
      job {
        id
        done
      }
    }
  }
`;

interface OrderCancelResponse {
  data?: {
    orderCancel?: {
      job?: { id: string; done?: boolean } | null;
      orderCancelUserErrors?: Array<{ code?: string; field?: string[] | null; message: string }>;
    } | null;
  };
  errors?: unknown;
}

/**
 * Cancels a Shopify order using GraphQL mutation with automatic REST fallback.
 * Defaults to reason: "CUSTOMER", restock: true.
 */
export async function cancelShopifyOrder(
  admin: AdminGraphqlClient,
  orderId: string | number,
  reason: OrderCancelReason = "CUSTOMER",
  restock: boolean = true,
  shop?: string,
  accessToken?: string,
): Promise<void> {
  const id = toOrderGid(orderId);
  const numericId = String(orderId).replace(/\D/g, "");

  let cancelled = false;
  try {
    const response = await admin.graphql(ORDER_CANCEL_MUTATION, {
      variables: {
        orderId: id,
        reason,
        restock,
      },
    });
    const json = (await response.json()) as OrderCancelResponse;
    if (json.data?.orderCancel && (!json.data.orderCancel.orderCancelUserErrors || json.data.orderCancel.orderCancelUserErrors.length === 0)) {
      cancelled = true;
    }
  } catch (graphqlErr: any) {
    console.warn(`[shopify-orders] GraphQL orderCancel notice (${graphqlErr.message}), trying REST fallback...`);
  }

  // REST cancellation fallback
  if (!cancelled && shop && accessToken && numericId) {
    try {
      const restUrl = `https://${shop}/admin/api/2025-01/orders/${numericId}/cancel.json`;
      const restRes = await fetch(restUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          reason: reason.toLowerCase(),
          restock: restock,
        }),
      });
      const restData = await restRes.json();
      if (restRes.ok && restData?.order) {
        cancelled = true;
        console.log(`[shopify-orders] Order ${numericId} cancelled via REST fallback with restock: ${restock}`);
      }
    } catch (restErr: any) {
      console.error(`[shopify-orders] REST cancel fallback error:`, restErr.message);
    }
  }

  if (!cancelled) {
    throw new ShopifyOrderCancelError(`orderCancel failed across both GraphQL and REST for order ${id}`, id);
  }
}

/**
 * Helper to tag an expired COD order in Shopify.
 */
export async function tagOrderExpired(
  admin: AdminGraphqlClient,
  orderId: string | number,
  tag: string = "COD-Expired",
): Promise<void> {
  await addOrderTags(admin, orderId, [tag]);
}

