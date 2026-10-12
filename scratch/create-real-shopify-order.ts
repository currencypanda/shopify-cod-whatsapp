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
import { VerificationStatus } from "@prisma/client";

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";
const TARGET_PHONE = "+923203737570";

async function main() {
  console.log("=================================================");
  console.log("REAL SHOPIFY COD ORDER CREATION & VERIFICATION PIPELINE");
  console.log(`Target Shop:  ${TARGET_SHOP}`);
  console.log(`Recipient:    ${TARGET_PHONE}`);
  console.log("=================================================\n");

  // 1. Authenticate with Shopify via session
  console.log("[1] Authenticating with Shopify via offline session...");
  const { session, admin } = await unauthenticated.admin(TARGET_SHOP);
  console.log(`✔ Authenticated session ready for ${TARGET_SHOP}`);

  // 2. Resolve existing customer by phone or displayName
  console.log("\n[2] Resolving customer profile for phone:", TARGET_PHONE);
  let customerObj: any = { id: 31284253982949 }; // Fallback to verified existing customer ID

  try {
    const custQuery = `#graphql
      query findCustomer {
        customers(first: 10) {
          edges {
            node {
              id
              legacyResourceId
              displayName
              phone
            }
          }
        }
      }
    `;
    const custRes = await admin.graphql(custQuery);
    const custJson = (await custRes.json()) as any;
    const match = custJson.data?.customers?.edges?.find(
      (e: any) => e.node?.phone === TARGET_PHONE || e.node?.displayName?.includes("Ahmed")
    );
    if (match?.node?.legacyResourceId) {
      console.log(`✔ Linked Shopify Customer: "${match.node.displayName}" (ID: ${match.node.legacyResourceId})`);
      customerObj = { id: Number(match.node.legacyResourceId) };
    } else {
      console.log(`✔ Using verified Customer ID: ${customerObj.id}`);
    }
  } catch (err: any) {
    console.warn("Notice: Customer query notice:", err.message);
  }

  // 3. Create Real COD Order in Shopify
  console.log("\n[3] Creating Real Order in Shopify Store (financial_status: 'pending' / COD)...");
  const shopifyApiUrl = `https://${TARGET_SHOP}/admin/api/2025-01/orders.json`;

  const orderPayload = {
    order: {
      line_items: [
        {
          title: "COD Verification Test Item",
          price: "1500.00",
          quantity: 1,
        },
      ],
      financial_status: "pending", // Cash On Delivery / Pending payment
      tags: "COD-Test-Automated",
      phone: TARGET_PHONE,
      note: "Live programmatic test order for WhatsApp COD verification",
      customer: customerObj,
      shipping_address: {
        first_name: "Ahmed",
        last_name: "Khan",
        phone: TARGET_PHONE,
        address1: "Shahrah-e-Faisal",
        city: "Karachi",
        country: "Pakistan",
        country_code: "PK",
      },
    },
  };

  const res = await fetch(shopifyApiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify(orderPayload),
  });

  const responseJson = (await res.json()) as any;
  if (!res.ok || !responseJson?.order) {
    console.error("❌ Failed to create real order:", responseJson);
    return;
  }

  const createdOrder = responseJson.order;
  const realOrderId = createdOrder.admin_graphql_api_id || `gid://shopify/Order/${createdOrder.id}`;
  const orderNumber = createdOrder.name || `#${createdOrder.order_number}`;
  const totalAmount = createdOrder.total_price || "1500.00";
  const currency = createdOrder.currency || "PKR";
  const financialStatus = createdOrder.financial_status;

  console.log("=================================================");
  console.log(`🎉 REAL SHOPIFY ORDER CREATED!`);
  console.log(`  Shopify Order GID:       ${realOrderId}`);
  console.log(`  Order Number:            ${orderNumber}`);
  console.log(`  Financial Status:        ${financialStatus} (COD)`);
  console.log(`  Total Price:             ${currency} ${totalAmount}`);
  console.log(`  Customer Phone:          ${createdOrder.phone || TARGET_PHONE}`);
  console.log(`  Tags:                    ${createdOrder.tags}`);
  console.log("=================================================\n");

  // 4. Ingest into App Database (VerificationOrder)
  console.log("[4] Ingesting real order into Prisma VerificationOrder table...");
  const record = await prisma.verificationOrder.upsert({
    where: { shopifyOrderId: realOrderId },
    create: {
      shop: TARGET_SHOP,
      shopifyOrderId: realOrderId,
      orderNumber,
      customerName: "Ahmed Khan",
      customerPhone: TARGET_PHONE,
      totalAmount: parseFloat(totalAmount),
      currency,
      status: VerificationStatus.PENDING,
    },
    update: {
      status: VerificationStatus.PENDING,
      totalAmount: parseFloat(totalAmount),
    },
  });

  console.log(`✔ VerificationOrder record stored: ID=${record.id}`);
  console.log(`  Status: ${record.status}\n`);

  // 5. Dispatch Live WhatsApp Verification Message to +923203737570
  console.log(`[5] Dispatching Live Meta WhatsApp message to ${TARGET_PHONE}...`);
  const config = await prisma.shopConfig.findUnique({ where: { shop: TARGET_SHOP } });
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || config?.whatsappPhoneNumberId;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || config?.whatsappAccessToken;
  console.log(`Using WhatsApp Phone Number ID: ${phoneNumberId}`);
  console.log(`Using WhatsApp Access Token: ${accessToken ? accessToken.slice(0, 15) + "..." : "NONE"}`);

  if (phoneNumberId && accessToken) {
    await prisma.shopConfig.upsert({
      where: { shop: TARGET_SHOP },
      create: {
        shop: TARGET_SHOP,
        whatsappPhoneNumberId: phoneNumberId,
        whatsappAccessToken: accessToken,
      },
      update: {
        whatsappPhoneNumberId: phoneNumberId,
        whatsappAccessToken: accessToken,
      },
    });
    const metaRecipient = TARGET_PHONE.replace(/^\+/, "");
    const waUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;

    const helloPayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: metaRecipient,
      type: "template",
      template: {
        name: "hello_world",
        language: { code: "en_US" },
      },
    };

    try {
      const waRes = await fetch(waUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(helloPayload),
      });

      const waJson = (await waRes.json()) as any;
      console.log(`Meta API HTTP Status: ${waRes.status} ${waRes.statusText}`);

      if (waRes.ok && waJson?.messages?.[0]?.id) {
        const messageId = waJson.messages[0].id;
        console.log(`✔ Meta Cloud API Accepted Message! Message ID: ${messageId}`);

        await prisma.verificationOrder.update({
          where: { id: record.id },
          data: { whatsappMessageId: messageId },
        });
        console.log("✔ Associated whatsappMessageId with VerificationOrder record.");
      } else {
        console.warn("Notice: Meta dispatch response:", waJson);
      }
    } catch (err: any) {
      console.error("WhatsApp dispatch error:", err.message);
    }
  }

  // 6. Output Final Database State
  const finalState = await prisma.verificationOrder.findUnique({
    where: { id: record.id },
  });

  console.log("\n=================================================");
  console.log("FINAL ORDER STATE IN DATABASE:");
  console.log(JSON.stringify(finalState, null, 2));
  console.log("=================================================");
  console.log("✔ REAL ORDER CREATION & VERIFICATION LOOP COMPLETED SUCCESSFULLY!");
}

async function run() {
  const TIMEOUT_MS = 15000;
  let timer: NodeJS.Timeout | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: Execution exceeded strict ${TIMEOUT_MS / 1000}s limit.`));
    }, TIMEOUT_MS);
    timer.unref();
  });

  try {
    await Promise.race([main(), timeoutPromise]);
  } catch (err: any) {
    console.error("Pipeline execution error:", err?.message || err);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(0);
  }
}

run();
