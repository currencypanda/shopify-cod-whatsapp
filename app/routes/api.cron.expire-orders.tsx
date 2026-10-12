import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { processExpiredOrders } from "../services/cron-expiry.server";

/**
 * Auto-Expiry Cron Service — `/api/cron/expire-orders`
 *
 * Scans pending COD verification orders older than each shop's `autoExpiryHours`.
 * Transitions expired orders to `EXPIRED` status and tags them in Shopify (e.g. `COD-Expired`).
 *
 * Security:
 * Protected by `CRON_SECRET` via Bearer header, X-Cron-Secret header, or `?secret=` query parameter.
 */

function isAuthorized(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  const authHeader = request.headers.get("authorization");
  const customHeader = request.headers.get("x-cron-secret");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");

  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "").trim();

  return (
    bearerToken === expectedSecret ||
    customHeader === expectedSecret ||
    querySecret === expectedSecret
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (!isAuthorized(request)) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processExpiredOrders();
  return json(result);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (!isAuthorized(request)) {
    return json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await processExpiredOrders();
  return json(result);
};
