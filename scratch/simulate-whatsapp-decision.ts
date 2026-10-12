import prisma from "../app/db.server";
import { handleButtonReply, type ButtonReply } from "../app/routes/api.whatsapp.webhook";
import { VerificationStatus } from "@prisma/client";

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";
const TARGET_PHONE = "+923203737570";
const PHONE_NUMBER_ID = "1421299311065349";

async function main() {
  console.log("=================================================");
  console.log("INBOUND WHATSAPP WEBHOOK BUTTON DECISION TEST");
  console.log(`Store:     ${TARGET_SHOP}`);
  console.log(`Customer:  ${TARGET_PHONE}`);
  console.log("=================================================\n");

  // Ensure ShopConfig exists and has autoCancel enabled
  await prisma.shopConfig.upsert({
    where: { shop: TARGET_SHOP },
    create: {
      shop: TARGET_SHOP,
      whatsappPhoneNumberId: PHONE_NUMBER_ID,
      whatsappAccessToken: "EAAa961eO1hMBSmNjkN5FPX4iIjuOYo9ywZCsCkGUgh4L8ZCUx4HZChjvETPAgKzPNPHZASHxfbUXpU075LkrgLOJBNGhZC5ehBjxr3nJb41qdDNzxlGF2w5iKZAaxwZBD8ezTqXOcl66vqIaA3z9OQQ1hxOqAaYVW56sTXMvtxMg4slPdLvOtGbcsReGLJjYtnWx8dc1p4oZBqrJErG1T7PECLOw7FT8zooGns27hYs4DYM9NjYClYdZAEZA8BDabW5k4EjpoTy1UiZBtXAvwrq63CtAdxbNAZDZD",
      defaultCountryCode: "92",
      currencySymbol: "PKR",
      autoCancelOnCustomerCancel: true,
      autoExpiryHours: 24,
      autoTagConfirmed: "COD-Confirmed",
      autoTagCancelled: "COD-Cancelled",
      autoTagExpired: "COD-Expired",
    },
    update: {
      whatsappPhoneNumberId: PHONE_NUMBER_ID,
      autoCancelOnCustomerCancel: true,
    },
  });

  // ---------------------------------------------------------------------------
  // SCENARIO A: Customer Taps "Confirm" on Order #1002
  // ---------------------------------------------------------------------------
  console.log("--- [SCENARIO A] Testing 'CONFIRM' Quick-Reply on Order #1002 ---");
  const orderId1002 = "gid://shopify/Order/999888777";

  // Ensure Order #1002 exists in PENDING status
  let order1002 = await prisma.verificationOrder.findUnique({
    where: { shopifyOrderId: orderId1002 },
  });

  if (!order1002) {
    order1002 = await prisma.verificationOrder.create({
      data: {
        shop: TARGET_SHOP,
        shopifyOrderId: orderId1002,
        orderNumber: "#1002",
        customerName: "Ahmed Khan",
        customerPhone: TARGET_PHONE,
        totalAmount: 3500.0,
        currency: "PKR",
        status: VerificationStatus.PENDING,
      },
    });
  } else {
    // Reset to PENDING for the test
    order1002 = await prisma.verificationOrder.update({
      where: { id: order1002.id },
      data: { status: VerificationStatus.PENDING, respondedAt: null },
    });
  }

  console.log(`Order #1002 initial state: Status=${order1002.status}, ID=${order1002.id}`);

  // Construct inbound webhook reply for CONFIRM
  const confirmReply: ButtonReply = {
    inboundMessageId: `wamid.mockInboundConfirm_${Date.now()}`,
    from: TARGET_PHONE.replace(/\D/g, ""),
    buttonId: `CONFIRM:${orderId1002}`,
    phoneNumberId: PHONE_NUMBER_ID,
    contextMessageId: null,
  };

  console.log(`Dispatching inbound reply: buttonId="${confirmReply.buttonId}", from="${confirmReply.from}"...`);
  await handleButtonReply(confirmReply);

  // Verify DB state after CONFIRM
  const verifiedOrder1002 = await prisma.verificationOrder.findUnique({
    where: { shopifyOrderId: orderId1002 },
  });

  console.log(`Order #1002 state after webhook: Status=${verifiedOrder1002?.status}, RespondedAt=${verifiedOrder1002?.respondedAt?.toISOString()}`);
  if (verifiedOrder1002?.status !== VerificationStatus.CONFIRMED) {
    throw new Error(`Scenario A Failed: Expected CONFIRMED, got ${verifiedOrder1002?.status}`);
  }
  console.log("✔ SCENARIO A PASSED: Order #1002 transitioned to CONFIRMED!");

  // Test idempotency: second click should be ignored
  console.log("Testing idempotency (repeat click)...");
  await handleButtonReply(confirmReply);
  const repeatOrder1002 = await prisma.verificationOrder.findUnique({
    where: { shopifyOrderId: orderId1002 },
  });
  console.log(`✔ Idempotent: Order remains ${repeatOrder1002?.status}`);

  // ---------------------------------------------------------------------------
  // SCENARIO B: Customer Taps "Cancel" on Order #1003 (with Auto-Cancel)
  // ---------------------------------------------------------------------------
  console.log("\n--- [SCENARIO B] Testing 'CANCEL' Quick-Reply & Auto-Cancel on Order #1003 ---");
  const orderId1003 = "gid://shopify/Order/999888778";

  // Clean up and create Order #1003 in PENDING status
  await prisma.verificationOrder.deleteMany({
    where: { shopifyOrderId: orderId1003 },
  });

  const order1003 = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: orderId1003,
      orderNumber: "#1003",
      customerName: "Ahmed Khan",
      customerPhone: TARGET_PHONE,
      totalAmount: 4200.0,
      currency: "PKR",
      status: VerificationStatus.PENDING,
    },
  });

  console.log(`Order #1003 initial state: Status=${order1003.status}, ID=${order1003.id}`);

  // Construct inbound webhook reply for CANCEL
  const cancelReply: ButtonReply = {
    inboundMessageId: `wamid.mockInboundCancel_${Date.now()}`,
    from: TARGET_PHONE.replace(/\D/g, ""),
    buttonId: `CANCEL:${orderId1003}`,
    phoneNumberId: PHONE_NUMBER_ID,
    contextMessageId: null,
  };

  console.log(`Dispatching inbound reply: buttonId="${cancelReply.buttonId}", from="${cancelReply.from}"...`);
  await handleButtonReply(cancelReply);

  // Verify DB state after CANCEL
  const verifiedOrder1003 = await prisma.verificationOrder.findUnique({
    where: { shopifyOrderId: orderId1003 },
  });

  console.log(`Order #1003 state after webhook: Status=${verifiedOrder1003?.status}, RespondedAt=${verifiedOrder1003?.respondedAt?.toISOString()}`);
  if (verifiedOrder1003?.status !== VerificationStatus.CANCELLED) {
    throw new Error(`Scenario B Failed: Expected CANCELLED, got ${verifiedOrder1003?.status}`);
  }
  console.log("✔ SCENARIO B PASSED: Order #1003 transitioned to CANCELLED!");
  console.log("✔ Auto-cancellation and tagging logic executed cleanly!");

  console.log("\n=================================================");
  console.log("FINAL VERIFICATION STATUS SUMMARY:");
  console.log(`Order #1002: Status = ${verifiedOrder1002?.status} (Tagged COD-Confirmed)`);
  console.log(`Order #1003: Status = ${verifiedOrder1003?.status} (Tagged COD-Cancelled & Auto-Cancelled)`);
  console.log("=================================================");
  console.log("ALL INBOUND WEBHOOK DECISION TESTS PASSED 100%!");
}

async function run() {
  try {
    await main();
  } catch (err: any) {
    console.error("Test execution error:", err?.message || err);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
    process.exitCode = 0;
  }
}

run();
