import prisma from "../app/db.server";
import { processExpiredOrders } from "../app/routes/api.cron.expire-orders";
import { VerificationStatus } from "@prisma/client";

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";
const TEST_ORDER_ID = "gid://shopify/Order/cron-live-test-888";

async function main() {
  console.log("=================================================");
  console.log("LIVE AUTO-EXPIRY CRON JOB TEST");
  console.log(`Store: ${TARGET_SHOP}`);
  console.log("=================================================\n");

  // 1. Clean up any existing test order
  await prisma.verificationOrder.deleteMany({
    where: { shopifyOrderId: TEST_ORDER_ID },
  });

  // 2. Insert mock order created 30 hours ago (beyond the 24h threshold)
  const createdAt30HoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
  const createdOrder = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: TEST_ORDER_ID,
      orderNumber: "#CRON-888",
      customerName: "Test Customer",
      customerPhone: "+923203737570",
      totalAmount: 2800.0,
      currency: "PKR",
      status: VerificationStatus.PENDING,
      createdAt: createdAt30HoursAgo,
    },
  });

  console.log("[1] Inserted mock order created 30 hours ago:");
  console.log(`    Order ID:   ${createdOrder.id}`);
  console.log(`    Order #:    ${createdOrder.orderNumber}`);
  console.log(`    Status:     ${createdOrder.status}`);
  console.log(`    Created At: ${createdOrder.createdAt.toISOString()}`);

  // 3. Trigger auto-expiry processing
  console.log("\n[2] Triggering processExpiredOrders()...");
  const result = await processExpiredOrders();
  console.log("Cron Result Summary:", JSON.stringify(result, null, 2));

  // 4. Assert that the mock order transitioned to EXPIRED
  const updatedOrder = await prisma.verificationOrder.findUnique({
    where: { id: createdOrder.id },
  });

  console.log("\n[3] Verifying database state after cron run:");
  console.log(`    Order ID:   ${updatedOrder?.id}`);
  console.log(`    Status:     ${updatedOrder?.status}`);
  console.log(`    Updated At: ${updatedOrder?.updatedAt.toISOString()}`);

  if (updatedOrder?.status === VerificationStatus.EXPIRED) {
    console.log("\n✔ SUCCESS: Order successfully transitioned from PENDING -> EXPIRED!");
  } else {
    throw new Error(`Expected status EXPIRED but got ${updatedOrder?.status}`);
  }

  // 5. Clean up test order
  await prisma.verificationOrder.deleteMany({
    where: { shopifyOrderId: TEST_ORDER_ID },
  });
  console.log("✔ Test record cleaned up.");
}

async function run() {
  try {
    await main();
  } catch (err: any) {
    console.error("Cron test error:", err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
    process.exitCode = 0;
  }
}

run();
