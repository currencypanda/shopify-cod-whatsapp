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

  const orderGid = "gid://shopify/Order/18946235465957";

  // Test node query
  const query = `#graphql
    query GetNodeTags($id: ID!) {
      node(id: $id) {
        ... on HasTags {
          tags
        }
      }
    }
  `;

  try {
    const res = await admin.graphql(query, {
      variables: { id: orderGid },
    });
    const json = await res.json();
    console.log("query GetNodeTags response:", JSON.stringify(json));
  } catch (err: any) {
    console.log("query GetNodeTags error:", err.message);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
