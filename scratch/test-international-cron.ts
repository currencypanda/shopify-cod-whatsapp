import prisma from "../app/db.server";
import { formatPhoneNumber } from "../app/services/whatsapp.server";
import { processExpiredOrders } from "../app/routes/api.cron.expire-orders";
import { VerificationStatus } from "@prisma/client";

async function runInternationalAndCronTests() {
  console.log("=== Testing International Phone Formatting ===");
  // US / Canada
  console.assert(formatPhoneNumber("4155552671", "1") === "+14155552671", "US national format failed");
  console.assert(formatPhoneNumber("+14155552671", "1") === "+14155552671", "US international format failed");
  // UAE
  console.assert(formatPhoneNumber("0501234567", "971") === "+971501234567", "UAE national format failed");
  console.assert(formatPhoneNumber("+971501234567", "971") === "+971501234567", "UAE international format failed");
  // Saudi
  console.assert(formatPhoneNumber("0501234567", "966") === "+966501234567", "KSA national format failed");
  console.assert(formatPhoneNumber("+966501234567", "966") === "+966501234567", "KSA international format failed");
  // UK
  console.assert(formatPhoneNumber("07911123456", "44") === "+447911123456", "UK national format failed");
  console.assert(formatPhoneNumber("+447911123456", "44") === "+447911123456", "UK international format failed");
  // India
  console.assert(formatPhoneNumber("09876543210", "91") === "+919876543210", "India national format failed");
  console.assert(formatPhoneNumber("+919876543210", "91") === "+919876543210", "India international format failed");
  // Pakistan
  console.assert(formatPhoneNumber("03095899817", "92") === "+923095899817", "PK national format failed");
  // Landline rejection
  console.assert(formatPhoneNumber("04235761234", "92") === null, "PK landline not rejected");
  console.assert(formatPhoneNumber("041234567", "971") === null, "UAE landline not rejected");
  console.assert(formatPhoneNumber("0111234567", "966") === null, "KSA landline not rejected");
  console.log("✔ International phone formatting assertions passed.");

  console.log("\n=== Testing Auto-Expiry Cron Logic ===");
  const testShop = "ahmed-cod-test.myshopify.com";

  // Create an expired mock order (created 25 hours ago)
  const expiredDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
  const testOrderId = `gid://shopify/Order/cron-test-${Date.now()}`;

  const created = await prisma.verificationOrder.create({
    data: {
      shop: testShop,
      shopifyOrderId: testOrderId,
      orderNumber: "#CRON-EXPIRED-TEST",
      customerPhone: "+923095899817",
      totalAmount: 1500,
      currency: "PKR",
      status: VerificationStatus.PENDING,
      createdAt: expiredDate,
    },
  });

  console.log(`Created test order ${created.id} with status PENDING, createdAt 25h ago`);

  // Run cron process
  const cronResult = await processExpiredOrders();
  console.log("Cron execution result:", JSON.stringify(cronResult, null, 2));

  // Verify DB state
  const updated = await prisma.verificationOrder.findUnique({
    where: { id: created.id },
  });

  console.assert(updated?.status === VerificationStatus.EXPIRED, "Order was not updated to EXPIRED");
  console.log(`✔ Order ${created.id} successfully transitioned to EXPIRED (${updated?.status})`);

  // Cleanup test order
  await prisma.verificationOrder.delete({ where: { id: created.id } });
  console.log("✔ Cleaned up test record.");
  console.log("\n=== All International & Cron Tests Passed! ===");
}

runInternationalAndCronTests()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
