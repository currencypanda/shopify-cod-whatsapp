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

  const orderGid = "gid://shopify/Order/18945598193893"; // Order #1007 (pending)

  const mutation = `#graphql
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

  try {
    const res = await admin.graphql(mutation, {
      variables: {
        orderId: orderGid,
        reason: "CUSTOMER",
        restock: true,
      },
    });
    const json = await res.json();
    console.log("orderCancel response:", JSON.stringify(json));
  } catch (err: any) {
    console.log("orderCancel error:", err.message);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
