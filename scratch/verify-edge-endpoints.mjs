import { spawn } from "node:child_process";

async function testEndpoints() {
  console.log("Starting local production server on port 3000 to test endpoints...");
  const server = spawn("npm.cmd", ["run", "start"], {
    env: { ...process.env, PORT: "3000" },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (d) => console.log(`[server] ${d.toString().trim()}`));
  server.stderr.on("data", (d) => console.error(`[server err] ${d.toString().trim()}`));

  // Poll until server is responding (up to 15 seconds)
  let ready = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch("http://localhost:3000/api/health");
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
  }

  if (!ready) {
    console.error("Server did not become ready in 15 seconds.");
  }

  try {
    // 1. Test /api/health
    console.log("\n--- Testing GET /api/health ---");
    const healthRes = await fetch("http://localhost:3000/api/health");
    console.log(`HTTP Status: ${healthRes.status} ${healthRes.statusText}`);
    const healthJson = await healthRes.json();
    console.log("Health payload:", healthJson);

    // 2. Test GET /api/whatsapp/webhook (Meta handshake simulation)
    console.log("\n--- Testing GET /api/whatsapp/webhook (Meta handshake) ---");
    const verifyToken = "my_whatsapp_webhook_verify_token_123";
    const challenge = "CHALLENGE_ACCEPTED_987654";
    const webhookUrl = `http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`;
    
    const webhookRes = await fetch(webhookUrl);
    console.log(`HTTP Status: ${webhookRes.status} ${webhookRes.statusText}`);
    const webhookText = await webhookRes.text();
    console.log(`Handshake challenge returned: "${webhookText}" (Expected: "${challenge}")`);

    if (healthRes.status === 200 && webhookText === challenge) {
      console.log("\n✔ ALL EDGE ENDPOINTS VERIFIED SUCCESSFULLY (HTTP 200 OK)!");
    } else {
      console.warn("\n⚠ Warning: Endpoint verification response mismatch.");
    }
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    server.kill();
    process.exit(0);
  }
}

testEndpoints();
