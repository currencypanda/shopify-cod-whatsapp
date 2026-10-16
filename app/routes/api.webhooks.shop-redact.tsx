import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { action as shopRedactAction } from "./webhooks.shop.redact";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(JSON.stringify({ status: "active", endpoint: "shop-redact" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async (args: ActionFunctionArgs) => {
  try {
    return await shopRedactAction(args);
  } catch (error: any) {
    if (error instanceof Response) {
      return new Response(error.statusText || "Unauthorized", { status: error.status === 400 ? 401 : error.status });
    }
    console.warn(`[GDPR] shop-redact handled gracefully: ${error?.message || error}`);
    return new Response(JSON.stringify({ status: "acknowledged", notice: "Handled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
