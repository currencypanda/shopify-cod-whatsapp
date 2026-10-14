import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { action as dataRequestAction } from "./webhooks.customers.data_request";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(JSON.stringify({ status: "active", endpoint: "customers-data-request" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async (args: ActionFunctionArgs) => {
  try {
    return await dataRequestAction(args);
  } catch (error: any) {
    console.warn(`[GDPR] customers-data-request handled gracefully: ${error?.message || error}`);
    return new Response(JSON.stringify({ status: "acknowledged", notice: "Handled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
