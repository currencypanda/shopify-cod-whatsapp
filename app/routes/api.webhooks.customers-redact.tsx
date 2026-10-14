import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { action as redactAction } from "./webhooks.customers.redact";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(JSON.stringify({ status: "active", endpoint: "customers-redact" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async (args: ActionFunctionArgs) => {
  try {
    return await redactAction(args);
  } catch (error: any) {
    console.warn(`[GDPR] customers-redact handled gracefully: ${error?.message || error}`);
    return new Response(JSON.stringify({ status: "acknowledged", notice: "Handled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
