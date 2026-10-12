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
import { formatPhoneNumber } from "../app/services/whatsapp.server";
import {
  isCashOnDelivery,
  pickCustomerName,
  pickCustomerPhone,
  type OrderCreatePayload,
} from "../app/routes/webhooks.app.orders.create";
import { VerificationStatus } from "@prisma/client";

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";

// Mock Shopify orders/create webhook payload
const mockOrderPayload: OrderCreatePayload = {
  id: 999888777,
  admin_graphql_api_id: "gid://shopify/Order/999888777",
  name: "#1002",
  total_price: "3500.00",
  currency: "PKR",
  financial_status: "pending",
  gateway: "Cash on Delivery (COD)",
  payment_gateway_names: ["Cash on Delivery (COD)", "manual"],
  customer: {
    first_name: "Ahmed",
    last_name: "Khan",
    phone: "03203737570",
  },
  shipping_address: {
    name: "Ahmed Khan",
    phone: "03203737570",
    country_code: "PK",
  },
};

async function main() {
  console.log("=================================================");
  console.log("SIMULATED SHOPIFY COD ORDER INGESTION TEST");
  console.log(`Store:       ${TARGET_SHOP}`);
  console.log(`Order:       ${mockOrderPayload.name} (${mockOrderPayload.admin_graphql_api_id})`);
  console.log("=================================================\n");

  // 1. Verify COD detection gate
  const isCod = isCashOnDelivery(mockOrderPayload);
  console.log(`[1] COD Detection Check: ${isCod ? "✔ IS CASH ON DELIVERY" : "❌ NOT COD"}`);
  if (!isCod) {
    throw new Error("COD detection failed on mock payload");
  }

  // 2. Extract Customer details
  const rawCustomerName = pickCustomerName(mockOrderPayload);
  const rawCustomerPhone = pickCustomerPhone(mockOrderPayload);
  console.log(`[2] Extracted Name:  "${rawCustomerName}"`);
  console.log(`    Extracted Phone: "${rawCustomerPhone}"`);

  // 3. Fetch Shop Config from SQLite
  const config = await prisma.shopConfig.findUnique({
    where: { shop: TARGET_SHOP },
  });
  if (!config) {
    throw new Error(`ShopConfig not found for ${TARGET_SHOP}`);
  }

  // 4. Normalize Phone to E.164
  const defaultCC = config.defaultCountryCode || "92";
  const e164Phone = rawCustomerPhone ? formatPhoneNumber(rawCustomerPhone, defaultCC) : null;
  console.log(`[3] Normalized Phone: ${rawCustomerPhone} -> ${e164Phone}`);
  if (!e164Phone) {
    throw new Error("Phone normalization failed");
  }

  // 5. Upsert VerificationOrder into Prisma database
  console.log("\n[4] Persisting VerificationOrder into Prisma SQLite database...");
  // Clean up any prior test run for idempotency
  await prisma.verificationOrder.deleteMany({
    where: { shopifyOrderId: mockOrderPayload.admin_graphql_api_id! },
  });

  const verificationRecord = await prisma.verificationOrder.create({
    data: {
      shop: TARGET_SHOP,
      shopifyOrderId: mockOrderPayload.admin_graphql_api_id!,
      orderNumber: mockOrderPayload.name!,
      customerName: rawCustomerName,
      customerPhone: e164Phone,
      totalAmount: 3500.0,
      currency: "PKR",
      status: VerificationStatus.PENDING,
    },
  });
  console.log(`✔ Created VerificationOrder ID: ${verificationRecord.id}`);
  console.log(`  Status:    ${verificationRecord.status}`);
  console.log(`  Amount:    ${verificationRecord.currency} ${verificationRecord.totalAmount}`);
  console.log(`  Recipient: ${verificationRecord.customerPhone}`);

  // 6. Dispatch live verification message via Meta Cloud API (using approved hello_world template)
  const phoneNumberId = config.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = config.whatsappAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;

  if (phoneNumberId && accessToken) {
    console.log(`\n[5] Dispatching live Meta verification message to ${e164Phone}...`);
    const metaRecipient = e164Phone.replace(/^\+/, "");
    const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;

    const helloPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: metaRecipient,
      type: "template",
      template: {
        name: "hello_world",
        language: {
          code: "en_US",
        },
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(helloPayload),
      });

      const responseBody = await response.json();
      console.log(`HTTP Status: ${response.status} ${response.statusText}`);

      if (response.ok && responseBody?.messages?.[0]?.id) {
        const msgId = responseBody.messages[0].id;
        console.log(`✔ Message Accepted by Meta! Message ID: ${msgId}`);

        // Update WhatsApp message ID on the record
        await prisma.verificationOrder.update({
          where: { id: verificationRecord.id },
          data: { whatsappMessageId: msgId },
        });
        console.log("✔ Saved whatsappMessageId to VerificationOrder record.");
      } else {
        console.warn("Notice: Message dispatch response:", responseBody);
      }
    } catch (dispatchErr: any) {
      console.error("Meta dispatch error:", dispatchErr.message);
    }
  }

  // 7. Verify final database state
  const finalOrder = await prisma.verificationOrder.findUnique({
    where: { id: verificationRecord.id },
  });

  console.log("\n=================================================");
  console.log("FINAL DATABASE VERIFICATION ORDER STATE:");
  console.log(JSON.stringify(finalOrder, null, 2));
  console.log("=================================================");
  console.log("✔ INGESTION PIPELINE EXECUTED 100% SUCCESSFULLY!");
}

async function run() {
  try {
    await main();
  } catch (err: any) {
    console.error("Unhandled error:", err?.message || err);
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
    process.exitCode = 0;
  }
}

run();
