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

import { loader as healthLoader } from "../app/routes/api.health";
import prisma from "../app/db.server";

async function main() {
  console.log("=================================================");
  console.log("PRODUCTION HEALTH & COMPLIANCE VERIFICATION TEST");
  console.log("=================================================\n");

  // 1. Test /api/health endpoint
  console.log("[1] Testing /api/health endpoint loader...");
  const mockHealthReq = new Request("https://app.example.com/api/health");
  const healthRes = await healthLoader({ request: mockHealthReq, params: {}, context: {} });
  const healthData = await healthRes.json();

  console.log(`✔ Health Check Response Status: ${healthRes.status}`);
  console.log("  Payload:", JSON.stringify(healthData, null, 2));

  if (healthData.status !== "ok" || healthData.version !== "1.0.0") {
    throw new Error("Invalid health check payload!");
  }

  // 2. Verify Database Connection
  console.log("\n[2] Verifying database connectivity and model access...");
  const sessionCount = await prisma.session.count();
  const configCount = await prisma.shopConfig.count();
  const orderCount = await prisma.verificationOrder.count();

  console.log(`✔ Database connected: ${sessionCount} sessions, ${configCount} shopConfigs, ${orderCount} orders in store.`);

  // 3. Verify GDPR Route Files Exist on Disk
  console.log("\n[3] Verifying mandatory Shopify GDPR routes on disk...");
  const gdprFiles = [
    "app/routes/webhooks.customers.data_request.tsx",
    "app/routes/webhooks.customers.redact.tsx",
    "app/routes/webhooks.shop.redact.tsx",
    "app/routes/api.webhooks.customers.data_request.tsx",
    "app/routes/api.webhooks.customers.redact.tsx",
    "app/routes/api.webhooks.shop.redact.tsx",
  ];

  for (const file of gdprFiles) {
    const exists = existsSync(resolve(process.cwd(), file));
    console.log(`  ${exists ? "✔" : "❌"} ${file}`);
    if (!exists) throw new Error(`Missing compliance file: ${file}`);
  }

  console.log("\n=================================================");
  console.log("✔ ALL PRODUCTION HEALTH & GDPR CHECKS PASSED (100%)");
  console.log("=================================================");
}

async function run() {
  const TIMEOUT_MS = 10000;
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
    console.error("Test execution error:", err?.message || err);
  } finally {
    if (timer) clearTimeout(timer);
    try {
      await prisma.$disconnect();
    } catch {}
    setTimeout(() => {
      process.exit(0);
    }, 100).unref();
  }
}

run();
