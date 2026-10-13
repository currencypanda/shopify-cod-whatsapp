import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (val) process.env[key] = val;
    }
  }
}

import prisma from "../app/db.server";
import { unauthenticated } from "../app/shopify.server";

async function main() {
  const shop = "ahmed-cod-test.myshopify.com";
  const { session, admin } = await unauthenticated.admin(shop);
  console.log("Session scope:", session.scope);
  console.log("Session token exists:", !!session.accessToken);

  // Test 1: Check orders count
  const countRes = await fetch(`https://${shop}/admin/api/2025-01/orders/count.json`, {
    headers: {
      "X-Shopify-Access-Token": session.accessToken,
    },
  });
  console.log("GET /orders/count.json status:", countRes.status, await countRes.text());

  // Test 2: PUT /orders/18945600159973.json
  const orderId = "18945600159973";
  const putRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${orderId}.json`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      order: {
        id: Number(orderId),
        tags: "COD-Confirmed, Flow-Confirm",
        note: "[COD Verified via WhatsApp]",
      },
    }),
  });
  console.log("PUT /orders/:id.json status:", putRes.status, await putRes.text());

  // Test 3: POST /orders/:id/cancel.json
  const cancelRes = await fetch(`https://${shop}/admin/api/2025-01/orders/${orderId}/cancel.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({
      reason: "customer",
      email: false,
      restock: true,
    }),
  });
  console.log("POST /orders/:id/cancel.json status:", cancelRes.status, await cancelRes.text());

  await prisma.$disconnect();
}

main().catch(console.error);
