import { loader as healthLoader } from "../app/routes/api.health";
import { loader as webhookLoader } from "../app/routes/api.whatsapp.webhook";

async function testLoaders() {
  console.log("==========================================================");
  console.log("  Testing Route Loaders Directly                          ");
  console.log("==========================================================");

  // 1. Test api.health loader
  console.log("\n1. Testing /api/health loader...");
  const healthReq = new Request("http://localhost:3000/api/health");
  const healthResponse = await healthLoader({ request: healthReq, params: {}, context: {} });
  const healthData = await healthResponse.json();
  console.log(`HTTP Status: ${healthResponse.status}`);
  console.log("Payload:", healthData);

  // 2. Test api.whatsapp.webhook handshake loader
  console.log("\n2. Testing /api/whatsapp/webhook handshake loader...");
  process.env.WHATSAPP_VERIFY_TOKEN = "my_whatsapp_webhook_verify_token_123";
  const challenge = "CHALLENGE_ACCEPTED_777";
  const webhookUrl = `http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=my_whatsapp_webhook_verify_token_123&hub.challenge=${challenge}`;
  const webhookReq = new Request(webhookUrl);
  const webhookResponse = await webhookLoader({ request: webhookReq, params: {}, context: {} });
  const webhookBody = await webhookResponse.text();
  console.log(`HTTP Status: ${webhookResponse.status}`);
  console.log(`Returned challenge: "${webhookBody}" (Matches: ${webhookBody === challenge})`);

  if (healthResponse.status === 200 && webhookResponse.status === 200 && webhookBody === challenge) {
    console.log("\n✔ SUCCESS: All route loaders return HTTP 200 with compliant responses!");
  } else {
    console.error("\n❌ Error in loader responses");
    process.exit(1);
  }
}

testLoaders()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
