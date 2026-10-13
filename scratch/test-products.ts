import prisma from "../app/db.server";
import { unauthenticated } from "../app/shopify.server";

async function main() {
  const shop = "ahmed-cod-test.myshopify.com";
  const { admin } = await unauthenticated.admin(shop);

  const query = `#graphql
    query GetProducts {
      products(first: 5) {
        edges {
          node {
            id
            title
            variants(first: 1) {
              edges {
                node {
                  id
                  title
                  price
                  inventoryQuantity
                  inventoryItem {
                    id
                    tracked
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await admin.graphql(query);
    const data = await res.json();
    console.log("Products in store:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("Query failed:", e.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

main();
