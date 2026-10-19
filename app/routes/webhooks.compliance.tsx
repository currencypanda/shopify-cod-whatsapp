import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(JSON.stringify({ status: "active", endpoint: "compliance" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  // Throws 401 on missing or invalid HMAC
  const { shop, topic, payload } = await authenticate.webhook(request);
  return new Response(JSON.stringify({ status: "acknowledged", shop, topic }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
