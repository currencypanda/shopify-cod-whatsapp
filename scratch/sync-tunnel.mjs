import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const PORT = process.env.PORT || 3000;
const rootDir = resolve(process.cwd());
const tomlPath = join(rootDir, "shopify.app.toml");
const envPath = join(rootDir, ".env");
const infoPath = join(rootDir, "scratch", "tunnel-info.json");

console.log("==========================================================");
console.log("  SwiftCOD: Launching Cloudflare Tunnel & Environment Sync ");
console.log("==========================================================");
console.log(`[*] Target local address: http://localhost:${PORT}`);

const cloudflared = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${PORT}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

let tunnelUrl = null;
let resolved = false;

function handleOutput(data) {
  const text = data.toString();
  // Look for .trycloudflare.com URL
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match && !resolved) {
    resolved = true;
    tunnelUrl = match[0];
    console.log("\n==========================================================");
    console.log(`[✔] CLOUDFLARE TUNNEL ESTABLISHED!`);
    console.log(`    Gateway URL:       ${tunnelUrl}`);
    console.log(`    WhatsApp Webhook:  ${tunnelUrl}/api/whatsapp/webhook`);
    console.log(`    Auth Redirect URL: ${tunnelUrl}/api/auth`);
    console.log("==========================================================\n");

    // 1. Update shopify.app.toml
    if (existsSync(tomlPath)) {
      let toml = readFileSync(tomlPath, "utf-8");
      toml = toml.replace(/application_url\s*=\s*"[^"]*"/, `application_url = "${tunnelUrl}"`);
      toml = toml.replace(/redirect_urls\s*=\s*\[\s*"[^"]*"\s*\]/, `redirect_urls = [ "${tunnelUrl}/api/auth" ]`);
      writeFileSync(tomlPath, toml, "utf-8");
      console.log("[✔] shopify.app.toml updated successfully with Cloudflare gateway.");
    }

    // 2. Update .env
    if (existsSync(envPath)) {
      let env = readFileSync(envPath, "utf-8");
      if (env.includes("SHOPIFY_APP_URL=")) {
        env = env.replace(/SHOPIFY_APP_URL=.*/, `SHOPIFY_APP_URL=${tunnelUrl}`);
      } else {
        env += `\nSHOPIFY_APP_URL=${tunnelUrl}\n`;
      }
      writeFileSync(envPath, env, "utf-8");
      console.log("[✔] .env SHOPIFY_APP_URL updated.");
    }

    // 3. Write tunnel-info.json
    const info = {
      tunnelUrl,
      port: PORT,
      createdAt: new Date().toISOString(),
      metaWebhookCallbackUrl: `${tunnelUrl}/api/whatsapp/webhook`,
      metaWebhookVerifyToken: "my_whatsapp_webhook_verify_token_123",
      authRedirectUrl: `${tunnelUrl}/api/auth`,
      applicationUrl: tunnelUrl,
    };
    writeFileSync(infoPath, JSON.stringify(info, null, 2), "utf-8");
    console.log("[✔] scratch/tunnel-info.json saved.");

    console.log("\nMeta WhatsApp Webhook Configuration Guide:");
    console.log("1. Open Meta App Dashboard > WhatsApp > Configuration");
    console.log(`2. Callback URL: ${tunnelUrl}/api/whatsapp/webhook`);
    console.log("3. Verify Token: my_whatsapp_webhook_verify_token_123");
    console.log("4. Subscribe to Webhook Field: 'messages'");
    console.log("\nTunnel is active. Press Ctrl+C in standalone shell to terminate.");
  }
}

cloudflared.stdout.on("data", handleOutput);
cloudflared.stderr.on("data", handleOutput);

cloudflared.on("error", (err) => {
  console.error("[!] Failed to spawn cloudflared:", err.message);
  process.exit(1);
});

// Wait up to 25 seconds to establish tunnel
setTimeout(() => {
  if (!resolved) {
    console.warn("[!] Timeout waiting for tunnel URL. Cloudflare may still be connecting.");
  }
  // Exit the sync script after capturing and writing config, but note tunnel background command
  process.exit(0);
}, 15000);
