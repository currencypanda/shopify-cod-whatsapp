import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// Load environment variables directly from .env
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
      if (val) {
        process.env[key] = val;
      }
    }
  }
}

import prisma from "../app/db.server";
import { unauthenticated } from "../app/shopify.server";

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";

async function main() {
  console.log("Testing unauthenticated.admin for shop:", TARGET_SHOP);
  try {
    const { admin } = await unauthenticated.admin(TARGET_SHOP);
    console.log("✔ unauthenticated.admin successfully obtained admin context!");

    const testQuery = `#graphql
      query {
        shop {
          name
          myshopifyDomain
          plan {
            displayName
          }
        }
      }
    `;

    const res = await admin.graphql(testQuery);
    const data = await res.json();
    console.log("Shop query response:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Admin API Error:", err?.message || err);
  } finally {
    await prisma.$disconnect();
    process.exitCode = 0;
  }
}

main();
