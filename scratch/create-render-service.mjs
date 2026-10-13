const RENDER_API_KEY = "rnd_0WqWxkJD6Tyn7OpGOJbZXPkn8JWY";
const OWNER_ID = "tea-db6ifds9v7es73fj8720";
const REPO = "https://github.com/currencypanda/shopify-cod-whatsapp";
const SERVICE_NAME = "shopify-cod-whatsapp";

const envVars = [
  {
    key: "DATABASE_URL",
    value: "postgresql://postgres.qnmlgjxxsywyiqnktfas:Supabase%40333@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
  },
  {
    key: "DIRECT_URL",
    value: "postgresql://postgres.qnmlgjxxsywyiqnktfas:Supabase%40333@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
  },
  {
    key: "SHOPIFY_API_KEY",
    value: "4fcb316262573e0f882e29d1d8013cb0",
  },
  {
    key: "SHOPIFY_API_SECRET",
    value: process.env.SHOPIFY_API_SECRET || "",
  },
  {
    key: "SCOPES",
    value: "write_products,read_orders,write_orders,read_customers",
  },
  {
    key: "WHATSAPP_PHONE_NUMBER_ID",
    value: "1421299311065349",
  },
  {
    key: "WHATSAPP_ACCESS_TOKEN",
    value: "EAAa961eO1hMBSp7wzpyoPcvqJLS2ZBfjqfhYZC6tjGypondzZBZAIgkZBBhJWmiZAs2gzWZCMdXlOxJBfnbc9UU3P6ZBmuKoXt6DZB7wyBeQ0kbFitXyqUIk2uotdXs6YZB1aJ4vLPbyGsWyqR0VJtjKuJB693Kw6dgZAxVssActLkHbDFU1oELe5uNmXBF6nAJco4LBsRqNfsHBPuCjgpXtQg17ZAaSLz8XsZAwNZC6yZBrRyn4EwIaFwpLo0RkaZAPn2ZBauM5C2zLcHZBGN4ZBQGYvm7PAMyGeDEHKsZD",
  },
  {
    key: "WHATSAPP_VERIFY_TOKEN",
    value: "my_whatsapp_webhook_verify_token_123",
  },
  {
    key: "CRON_SECRET",
    value: "my_cron_secret_token_123",
  },
  {
    key: "NODE_ENV",
    value: "production",
  },
  {
    key: "PORT",
    value: "3000",
  },
];

async function deployToRender() {
  const headers = {
    Authorization: `Bearer ${RENDER_API_KEY}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  async function createServiceWithPlan(plan) {
    console.log(`Attempting to create web service with plan: ${plan}...`);
    const payload = {
      type: "web_service",
      name: SERVICE_NAME,
      ownerId: OWNER_ID,
      repo: REPO,
      branch: "main",
      autoDeploy: "yes",
      serviceDetails: {
        runtime: "node",
        plan: plan,
        region: "oregon",
        envSpecificDetails: {
          buildCommand: "npm install && npx prisma generate --schema=prisma/schema.postgresql.prisma && npm run build",
          startCommand: "npm run start",
        },
        envVars: envVars,
      },
    };

    const res = await fetch("https://api.render.com/v1/services", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
  }

  try {
    let result = await createServiceWithPlan("starter");

    if (!result.ok) {
      console.warn("Starter plan creation returned:", result.data);
      console.log("Retrying with 'free' plan...");
      result = await createServiceWithPlan("free");
    }

    if (!result.ok) {
      console.error("Failed to create Render service:", JSON.stringify(result.data, null, 2));
      process.exit(1);
    }

    const service = result.data.service || result.data;
    console.log("Service created successfully!");
    console.log("Service ID:", service.id);
    console.log("Service Name:", service.name);
    console.log("Service Slug/URL:", service.serviceDetails?.url || `https://${service.name}.onrender.com`);

    // Fetch initial deploy
    console.log("\nChecking initial deploy status...");
    const deploysRes = await fetch(`https://api.render.com/v1/services/${service.id}/deploys?limit=5`, { headers });
    const deploys = await deploysRes.json();
    console.log("Deploys:", JSON.stringify(deploys, null, 2));

  } catch (err) {
    console.error("Error creating Render service:", err);
    process.exit(1);
  }
}

deployToRender();
