import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Health Check Endpoint — `/api/health`
 * Used by load balancers, container orchestrators, and production uptime monitors.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return json(
    {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      service: "cod-whatsapp-verify",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Type": "application/json",
      },
    },
  );
};
