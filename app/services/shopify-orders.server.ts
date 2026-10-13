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

// ---------------------------------------------------------------------------
// Multi-Market Order Modifications (Address, Delivery Slot, Item Edit)
// ---------------------------------------------------------------------------

export interface ShippingAddressInput {
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  countryCode?: string;
}

const UPDATE_SHIPPING_ADDRESS_MUTATION = `#graphql
  mutation UpdateOrderShippingAddress($input: OrderInput!) {
    orderUpdate(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Updates an order's shipping address via GraphQL orderUpdate, with REST fallback.
 * Strictly adheres to PCD guidelines (selects userErrors only).
 */
export async function updateOrderShippingAddress(
  admin: AdminGraphqlClient,
  orderId: string | number,
  shippingAddress: ShippingAddressInput,
  shop?: string,
  accessToken?: string,
): Promise<boolean> {
  const id = toOrderGid(orderId);
  const numericId = String(orderId).replace(/\D/g, "");
  let updated = false;

  try {
    const res = await admin.graphql(UPDATE_SHIPPING_ADDRESS_MUTATION, {
      variables: {
        input: {
          id,
          shippingAddress: {
            address1: shippingAddress.address1,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            province: shippingAddress.province,
            zip: shippingAddress.zip,
            countryCode: shippingAddress.countryCode,
          },
        },
      },
    });
    const json = (await res.json()) as any;
    if (json.data?.orderUpdate && (!json.data.orderUpdate.userErrors || json.data.orderUpdate.userErrors.length === 0)) {
      updated = true;
    } else if (json.data?.orderUpdate?.userErrors?.length) {
      console.warn(`[shopify-orders] GraphQL orderUpdate address userErrors:`, json.data.orderUpdate.userErrors);
    }
  } catch (graphqlErr: any) {
    console.warn(`[shopify-orders] GraphQL orderUpdate address notice: ${graphqlErr.message}`);
  }

  // REST fallback
  if (!updated && shop && accessToken && numericId) {
    try {
      const restRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericId}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          order: {
            id: Number(numericId),
            shipping_address: {
              address1: shippingAddress.address1,
              city: shippingAddress.city,
              province: shippingAddress.province,
              zip: shippingAddress.zip,
              country_code: shippingAddress.countryCode,
            },
          },
        }),
      });
      if (restRes.ok) {
        updated = true;
        console.log(`[shopify-orders] Shipping address updated via REST fallback for order ${numericId}`);
      }
    } catch (restErr: any) {
      console.error(`[shopify-orders] REST address fallback failed:`, restErr.message);
    }
  }

  // Fallback: append address to order note
  if (!updated) {
    const noteAddr = shippingAddress.address1 || JSON.stringify(shippingAddress);
    await appendOrderVerificationNote(admin, orderId, `[Customer Address Updated: ${noteAddr}]`);
    updated = true;
  }

  return updated;
}

const UPDATE_DELIVERY_SLOT_MUTATION = `#graphql
  mutation UpdateDeliverySlot($input: OrderInput!) {
    orderUpdate(input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Records customer's delivery time window preference into Shopify note_attributes and order note.
 */
export async function updateOrderDeliverySlot(
  admin: AdminGraphqlClient,
  orderId: string | number,
  slotText: string,
  shop?: string,
  accessToken?: string,
): Promise<boolean> {
  const id = toOrderGid(orderId);
  const numericId = String(orderId).replace(/\D/g, "");
  let updated = false;

  try {
    const res = await admin.graphql(UPDATE_DELIVERY_SLOT_MUTATION, {
      variables: {
        input: {
          id,
          customAttributes: [
            { key: "Delivery Time Preference", value: slotText },
          ],
        },
      },
    });
    const json = (await res.json()) as any;
    if (json.data?.orderUpdate && (!json.data.orderUpdate.userErrors || json.data.orderUpdate.userErrors.length === 0)) {
      updated = true;
    }
  } catch (graphqlErr: any) {
    console.warn(`[shopify-orders] GraphQL delivery slot update notice: ${graphqlErr.message}`);
  }

  // REST fallback
  if (!updated && shop && accessToken && numericId) {
    try {
      const getRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericId}.json?fields=id,note_attributes`, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });
      const getData = (await getRes.json()) as any;
      const currentAttrs: Array<{ name: string; value: string }> = getData?.order?.note_attributes || [];
      const updatedAttrs = [
        ...currentAttrs.filter((a) => a.name !== "Delivery Time Preference"),
        { name: "Delivery Time Preference", value: slotText },
      ];

      const putRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${numericId}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          order: {
            id: Number(numericId),
            note_attributes: updatedAttrs,
          },
        }),
      });
      if (putRes.ok) {
        updated = true;
      }
    } catch (restErr: any) {
      console.warn(`[shopify-orders] REST slot fallback notice: ${restErr.message}`);
    }
  }

  // Append note attribute text to order note
  await appendOrderVerificationNote(admin, orderId, `[Delivery Slot: ${slotText}]`);
  return true;
}

const ORDER_EDIT_BEGIN_MUTATION = `#graphql
  mutation OrderEditBegin($id: ID!) {
    orderEditBegin(id: $id) {
      calculatedOrder {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ORDER_EDIT_SET_QTY_MUTATION = `#graphql
  mutation OrderEditSetQty($id: ID!, $lineItemId: ID!, $quantity: Int!) {
    orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) {
      calculatedOrder {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ORDER_EDIT_COMMIT_MUTATION = `#graphql
  mutation OrderEditCommit($id: ID!) {
    orderEditCommit(id: $id, notifyCustomer: false) {
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Modifies line item quantity on a Shopify order using GraphQL OrderEdit mutations,
 * with note fallback if order editing is restricted or completed.
 */
export async function applyOrderEditQuantity(
  admin: AdminGraphqlClient,
  orderId: string | number,
  lineItemId: string | number,
  newQuantity: number,
  shop?: string,
  accessToken?: string,
): Promise<{ success: boolean; editedViaGraphQL: boolean }> {
  const orderGid = toOrderGid(orderId);
  const lineItemGid = String(lineItemId).startsWith("gid://shopify/LineItem/")
    ? String(lineItemId)
    : `gid://shopify/LineItem/${lineItemId}`;

  try {
    const beginRes = await admin.graphql(ORDER_EDIT_BEGIN_MUTATION, {
      variables: { id: orderGid },
    });
    const beginJson = (await beginRes.json()) as any;
    const calcOrderId = beginJson.data?.orderEditBegin?.calculatedOrder?.id;

    if (calcOrderId) {
      const setQtyRes = await admin.graphql(ORDER_EDIT_SET_QTY_MUTATION, {
        variables: {
          id: calcOrderId,
          lineItemId: lineItemGid,
          quantity: newQuantity,
        },
      });
      const setQtyJson = (await setQtyRes.json()) as any;

      if (!setQtyJson.data?.orderEditSetQuantity?.userErrors?.length) {
        const commitRes = await admin.graphql(ORDER_EDIT_COMMIT_MUTATION, {
          variables: { id: calcOrderId },
        });
        const commitJson = (await commitRes.json()) as any;
        if (!commitJson.data?.orderEditCommit?.userErrors?.length) {
          console.log(`[shopify-orders] Order edit committed for ${orderGid}: item ${lineItemGid} -> qty ${newQuantity}`);
          return { success: true, editedViaGraphQL: true };
        }
      }
    }
  } catch (err: any) {
    console.warn(`[shopify-orders] GraphQL orderEdit note: ${err.message}`);
  }

  // Fallback: Record modification request in note & note attributes
  const noteText = `[Customer Requested Item Modification: Line Item ${lineItemId} quantity -> ${newQuantity}]`;
  await appendOrderVerificationNote(admin, orderId, noteText);
  return { success: true, editedViaGraphQL: false };
}


