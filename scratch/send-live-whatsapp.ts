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

const TARGET_SHOP = "ahmed-cod-test.myshopify.com";
const TARGET_PHONE = "+923203737570";
const TARGET_ORDER_GID = "gid://shopify/Order/18944099320037";
const TARGET_ORDER_NUMBER = "#1004";

async function main() {
  console.log("=================================================");
  console.log("LIVE META WHATSAPP DISPATCH FOR ORDER #1004");
  console.log(`Target Recipient: ${TARGET_PHONE}`);
  console.log(`Target Order:     ${TARGET_ORDER_NUMBER} (${TARGET_ORDER_GID})`);
  console.log(`Target Shop:      ${TARGET_SHOP}`);
  console.log("=================================================\n");

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();

  console.log(`Phone Number ID: ${phoneNumberId || "[MISSING]"}`);
  console.log(
    `Access Token:    ${accessToken ? `${accessToken.slice(0, 15)}...${accessToken.slice(-6)}` : "[MISSING]"}`
  );

  if (!phoneNumberId || !accessToken) {
    console.error(
      "\n❌ ERROR: Missing Meta WhatsApp credentials. Please configure WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env."
    );
    return;
  }

  // 1. Verify / fetch existing Order #1004 in Prisma
  console.log(`\n[1] Fetching order ${TARGET_ORDER_NUMBER} from database...`);
  const orderRecord = await prisma.verificationOrder.findFirst({
    where: {
      OR: [
        { shopifyOrderId: TARGET_ORDER_GID },
        { orderNumber: TARGET_ORDER_NUMBER },
      ],
    },
  });

  if (!orderRecord) {
    console.error(`❌ Order ${TARGET_ORDER_NUMBER} not found in database!`);
    return;
  }
  console.log(`✔ Found Order in DB: ID=${orderRecord.id}, Status=${orderRecord.status}, Amount=${orderRecord.currency} ${orderRecord.totalAmount}`);

  // 2. Sync fresh credentials to ShopConfig
  console.log(`\n[2] Syncing updated token to ShopConfig for ${TARGET_SHOP}...`);
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
  console.log("✔ ShopConfig updated in SQLite.");

  // 3. Format recipient phone
  const formattedPhone = formatPhoneNumber(TARGET_PHONE, "92");
  const metaRecipient = (formattedPhone || TARGET_PHONE).replace(/^\+/, "");
  console.log(`\n[3] Normalized recipient for Meta API: ${metaRecipient}`);

  // 4. Dispatch WhatsApp Message
  const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(phoneNumberId)}/messages`;

  // Try interactive template first, then hello_world fallback
  const codPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: metaRecipient,
    type: "template",
    template: {
      name: "cod_order_verification",
      language: { code: "en_US" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: orderRecord.customerName || "Customer" },
            { type: "text", text: orderRecord.orderNumber },
            { type: "text", text: `${orderRecord.currency} ${orderRecord.totalAmount}` },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [{ type: "payload", payload: `CONFIRM:${orderRecord.shopifyOrderId}` }],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [{ type: "payload", payload: `CANCEL:${orderRecord.shopifyOrderId}` }],
        },
      ],
    },
  };

  console.log(`\n[4] Dispatching WhatsApp verification message to Meta Cloud API...`);
  let res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(codPayload),
  });

  let resJson: any = null;
  try {
    resJson = await res.json();
  } catch {
    resJson = await res.text();
  }

  // Fallback to hello_world if cod_order_verification template not approved yet
  if (!res.ok && resJson?.error?.code === 132001) {
    console.log('[Notice] "cod_order_verification" template not approved yet in Meta account.');
    console.log('[Attempt 2] Fallback to pre-approved standard "hello_world" template...');

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

    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(helloPayload),
    });

    try {
      resJson = await res.json();
    } catch {
      resJson = await res.text();
    }
  }

  console.log(`\nMeta API HTTP Status: ${res.status} ${res.statusText}`);
  console.log("Meta API Response Body:\n", JSON.stringify(resJson, null, 2));

  // 5. Update Database Record with Meta Message ID on success
  if (res.ok && resJson?.messages?.[0]?.id) {
    const messageId = resJson.messages[0].id;
    console.log(`\n✔ Meta Message Accepted! ID: ${messageId}`);

    const updatedOrder = await prisma.verificationOrder.update({
      where: { id: orderRecord.id },
      data: {
        whatsappMessageId: messageId,
      },
    });

    console.log("=================================================");
    console.log("UPDATED ORDER RECORD IN DATABASE:");
    console.log(JSON.stringify(updatedOrder, null, 2));
    console.log("=================================================");
    console.log(`🎉 ORDER ${TARGET_ORDER_NUMBER} VERIFICATION DISPATCH COMPLETE!`);
  } else {
    console.error("\n❌ Meta dispatch was not successful.");
  }
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
    console.error("Execution error:", err?.message || err);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await prisma.$disconnect();
    } catch {}
    setTimeout(() => {
      process.exit(0);
    }, 200).unref();
  }
}

run();
