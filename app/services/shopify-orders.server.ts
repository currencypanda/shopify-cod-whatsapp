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
      node {
        id
      }
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
      node: { id: string } | null;
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
export async function updateOrderVerificationTag({
  shop,
  orderId,
  decision,
  confirmedTag = "COD-Confirmed",
  cancelledTag = "COD-Cancelled",
}: UpdateOrderVerificationTagParams): Promise<string> {
  const tag = decision === "CONFIRM" ? confirmedTag : cancelledTag;

  let admin: AdminGraphqlClient;
  try {
    ({ admin } = await unauthenticated.admin(shop));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ShopifyOrderTagError(
      `Could not load offline session for ${shop}: ${reason}`,
      String(orderId),
      error,
    );
  }

  await addOrderTags(admin, orderId, [tag]);
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
 * Cancels a Shopify order using the `orderCancel` GraphQL mutation.
 * Defaults to reason: "CUSTOMER", restock: true.
 * Requires `write_orders` scope.
 */
export async function cancelShopifyOrder(
  admin: AdminGraphqlClient,
  orderId: string | number,
  reason: OrderCancelReason = "CUSTOMER",
  restock: boolean = true,
): Promise<void> {
  const id = toOrderGid(orderId);

  let json: OrderCancelResponse;
  try {
    const response = await admin.graphql(ORDER_CANCEL_MUTATION, {
      variables: {
        orderId: id,
        reason,
        restock,
      },
    });
    json = (await response.json()) as OrderCancelResponse;
  } catch (error) {
    const reasonMsg = error instanceof Error ? error.message : String(error);
    throw new ShopifyOrderCancelError(`orderCancel request failed: ${reasonMsg}`, id, error);
  }

  if (json.errors) {
    throw new ShopifyOrderCancelError("orderCancel returned GraphQL errors", id, json.errors);
  }

  const payload = json.data?.orderCancel;
  if (!payload) {
    throw new ShopifyOrderCancelError("orderCancel returned an empty payload", id, json);
  }

  if (payload.orderCancelUserErrors && payload.orderCancelUserErrors.length > 0) {
    const message = payload.orderCancelUserErrors.map((e) => e.message).join("; ");
    throw new ShopifyOrderCancelError(`orderCancel user errors: ${message}`, id, payload.orderCancelUserErrors);
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

